from typing import TypedDict, List, Optional
from ai_evaluator import config
from ai_evaluator.models.model_loader import (
    judge1_llm, judge2_llm, judge3_llm, judge4_llm, judge5_llm, router_llm
)
from ai_evaluator.prompts.templates import (
    topic_prompt, logic_prompt, rebuttal_prompt, stance_prompt, delivery_prompt, router_prompt
)
from ai_evaluator.utils.helpers import (
    is_gibberish_or_empty, format_arguments_list, safe_float, safe_bool, norm
)
from ai_evaluator.utils.vector_store import get_topic_store, fetch_query_facts


# --- DEBATE STATE TYPED DICT ---

class DebateState(TypedDict):
    topic: str
    user1_args: List[str]
    user2_args: List[str]
    user1_stance: str
    user2_stance: str
    current_round: int
    current_user: str
    current_argument: str

    reasoning: List[str]
    related_score: float
    novelty_score: float
    topic_score: float
    fact_score: float
    stance_score: float
    delivery_score: float
    final_score: float
    gated: bool
    stance_gated: bool

    user1_total: float
    user2_total: float
    retrieved_facts: str
    raw_transcript: str

    knowledge_strategy: Optional[str]
    router_reason: Optional[str]
    router_confidence: Optional[float]
    search_query: Optional[str]



# --- SAFE LLM CALL WRAPPERS ---

def safe_judge3_call(topic: str, current: str, previous: str, retrieved_facts: str) -> dict:
    try:
        messages = topic_prompt.format_messages(
            topic=topic,
            current=current,
            previous=previous,
            retrieved_facts=retrieved_facts
        )
        res = judge3_llm.invoke(messages)
        return {
            "on_topic": res.on_topic,
            "reasoning": res.reasoning,
            "topic_score": res.topic_score,
            "novelty_score": res.novelty_score
        }
    except Exception as e:
        return {
            "on_topic": True,
            "reasoning": f"Judge 3 Fallback due to error: {str(e)[:100]}",
            "topic_score": 40.0,
            "novelty_score": 40.0
        }

def safe_judge1_call(topic: str, current: str, retrieved_facts: str) -> dict:
    try:
        messages = logic_prompt.format_messages(
            topic=topic,
            current=current,
            retrieved_facts=retrieved_facts
        )
        res = judge1_llm.invoke(messages)
        return {
            "reasoning": res.reasoning,
            "fact_score": res.fact_score
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 1 Fallback due to error: {str(e)[:100]}",
            "fact_score": 40.0
        }

def safe_judge2_call(topic: str, current: str, opponent: str) -> dict:
    try:
        messages = rebuttal_prompt.format_messages(
            topic=topic,
            current=current,
            opponent=opponent
        )
        res = judge2_llm.invoke(messages)
        return {
            "reasoning": res.reasoning,
            "related_score": res.related_score
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 2 Fallback due to error: {str(e)[:100]}",
            "related_score": 40.0
        }

def safe_judge4_call(topic: str, current: str, stance: str, opponent_stance: str) -> dict:
    try:
        messages = stance_prompt.format_messages(
            topic=topic,
            current=current,
            stance=stance,
            opponent_stance=opponent_stance
        )
        res = judge4_llm.invoke(messages)
        return {
            "is_violation": res.is_violation,
            "reasoning": res.reasoning,
            "stance_score": res.stance_score
        }
    except Exception as e:
        return {
            "is_violation": False,
            "reasoning": f"Judge 4 Fallback due to error: {str(e)[:100]}",
            "stance_score": 50.0
        }


def safe_judge5_call(raw_transcript: str, word_count: int) -> dict:
    try:
        messages = delivery_prompt.format_messages(
            raw_transcript=raw_transcript,
            word_count=word_count
        )
        res = judge5_llm.invoke(messages)
        return {
            "reasoning": res.reasoning,
            "delivery_score": res.delivery_score
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 5 Fallback due to error: {str(e)[:100]}",
            "delivery_score": 100.0
        }

def safe_router_call(topic: str, current: str) -> dict:
    try:
        messages = router_prompt.format_messages(topic=topic, current=current)
        res = router_llm.invoke(messages)
        return {
            "strategy": res.strategy,
            "reason": res.reason,
            "confidence": res.confidence,
            "search_query": res.search_query
        }
    except Exception as e:
        print(f"[Router Fallback] Error in router invocation: {e}")
        return {
            "strategy": "internal",
            "reason": f"Fallback due to routing error: {str(e)[:100]}",
            "confidence": 1.0,
            "search_query": ""
        }

# --- GUARDRAIL & SCORING SERVICES ---


def enforce_topic_consistency(res: dict) -> dict:
    for j in ("judge1", "judge2", "judge3"):
        on_topic = safe_bool(res.get(f"{j}_on_topic"), default=True)
        topic_score = safe_float(res.get(f"{j}_topic"))
        if not on_topic and topic_score > config.OFF_TOPIC_TOPIC_SCORE_CAP:
            res[f"{j}_topic"] = config.OFF_TOPIC_TOPIC_SCORE_CAP
    return res

def compute_final_score(related: float, novelty: float, topic: float, fact: float, stance: float, delivery: float):
    # Calculate the regular weighted score first
    weighted = (
        config.WEIGHTS["topic"] * topic +
        config.WEIGHTS["stance"] * stance +
        config.WEIGHTS["related"] * related +
        config.WEIGHTS["fact"] * fact +
        config.WEIGHTS["novelty"] * novelty +
        config.WEIGHTS["delivery"] * delivery
    )
    topic_gated = topic < config.TOPIC_GATE_THRESHOLD
    stance_gated = stance < config.STANCE_GATE_THRESHOLD

    if not topic_gated and not stance_gated:
        return round(norm(weighted), 2), False, False

    caps = []
    if topic_gated:
        caps.append(config.OFF_TOPIC_FINAL_SCORE_CAP)
    if stance_gated:
        caps.append(config.OFF_STANCE_FINAL_SCORE_CAP)

    cap = min(caps)
    final_score = min(weighted, cap)
    return round(norm(final_score), 2), topic_gated, stance_gated


# --- LANGGRAPH CORE NODES ---

def decide_knowledge_source_node(state: DebateState):
    topic = state["topic"]
    current_arg = state["current_argument"]
    
    if is_gibberish_or_empty(current_arg):
        return {
            "knowledge_strategy": "internal",
            "router_reason": "Argument is empty or gibberish; routing to internal to bypass search.",
            "router_confidence": 1.0,
            "search_query": ""
        }
    
    res = safe_router_call(topic, current_arg)
    print(f"[Router Node] Decided strategy: {res['strategy']} (confidence: {res['confidence']}) for query: '{current_arg[:60]}...'")
    return {
        "knowledge_strategy": res["strategy"],
        "router_reason": res["reason"],
        "router_confidence": float(res["confidence"]),
        "search_query": res["search_query"]
    }

def rag_tool_node(state: DebateState):
    topic = state["topic"]
    query = state.get("search_query")
    if not query or not query.strip():
        query = state["current_argument"]
        
    print(f"[RAG Tool] Retrieving local facts using query: '{query}'...")
    store = get_topic_store(topic)
    retrieved_chunks = store.retrieve(query, k=4)
    
    if retrieved_chunks:
        retrieved_context = "\n".join(f"- {chunk}" for chunk in retrieved_chunks)
        print(f"[RAG Tool] Successfully retrieved {len(retrieved_chunks)} chunks.")
        return {"retrieved_facts": retrieved_context}
    else:
        # Fall back to web search if RAG retrieved 0 chunks
        print("[RAG Tool] RAG retrieved 0 chunks. Falling back to Live Web Search...")
        return web_search_tool_node(state)

def web_search_tool_node(state: DebateState):
    query = state.get("search_query")
    if not query or not query.strip():
        query = state["current_argument"]
        
    print(f"[Web Tool] Performing live search using query: '{query}'...")
    retrieved_context = fetch_query_facts(query, max_results=5)
    
    if retrieved_context.strip():
        print("[Web Tool] Successfully retrieved live web search facts.")
        return {"retrieved_facts": retrieved_context}
    else:
        print("[Web Tool] Live web search returned 0 results. Falling back to default empty message.")
        return {"retrieved_facts": "No additional factual reference retrieved."}

def evaluate_topic_novelty_node(state: DebateState):
    topic = state["topic"]
    current_arg = state["current_argument"]

    if is_gibberish_or_empty(current_arg):
        return {
            "topic_score": 0.0,
            "novelty_score": 0.0,
            "reasoning": ["All Judges: Argument classified as empty, spam, or gibberish. Automatically scored 0."],
            "related_score": 0.0,
            "fact_score": 0.0,
            "stance_score": 0.0,
            "final_score": 0.0,
            "gated": True,
            "stance_gated": True,
            "retrieved_facts": "",
        }

    previous = state["user1_args"] if state["current_user"] == "user1" else state["user2_args"]
    previous = previous[-3:]
    previous_formatted = format_arguments_list(previous)

    retrieved_context = state.get("retrieved_facts", "").strip()
    if not retrieved_context:
        retrieved_context = "No additional context retrieved for this topic; rely on general knowledge of its likely subject area."

    try:
        res = safe_judge3_call(topic, current_arg, previous_formatted, retrieved_context)
        return {
            "topic_score": float(res["topic_score"]),
            "novelty_score": float(res["novelty_score"]),
            "reasoning": [f"[Topicality Auditor Judge]: {res['reasoning']}"],
            "gated": not res["on_topic"]
        }
    except Exception as e:
        return {
            "topic_score": 40.0,
            "novelty_score": 40.0,
            "reasoning": [f"[Topicality Auditor Judge]: Fallback triggered due to error: {str(e)[:100]}"],
            "gated": False
        }

def evaluate_logic_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg):
        return {}

    topic = state["topic"]
    retrieved_context = state.get("retrieved_facts", "").strip()
    if not retrieved_context:
        retrieved_context = "No additional factual reference retrieved."

    try:
        res = safe_judge1_call(topic, current_arg, retrieved_context)
        new_reasoning = state["reasoning"] + [f"[Logical Analyst Judge]: {res['reasoning']}"]
        return {
            "fact_score": float(res["fact_score"]),
            "reasoning": new_reasoning
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Logical Analyst Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "fact_score": 40.0,
            "reasoning": new_reasoning
        }


def evaluate_rebuttal_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg):
        return {}

    topic = state["topic"]
    opponent = state["user2_args"] if state["current_user"] == "user1" else state["user1_args"]
    opponent = opponent[-3:]
    opponent_formatted = format_arguments_list(opponent)

    try:
        res = safe_judge2_call(topic, current_arg, opponent_formatted)
        new_reasoning = state["reasoning"] + [f"[Rebuttal Evaluator Judge]: {res['reasoning']}"]
        return {
            "related_score": float(res["related_score"]),
            "reasoning": new_reasoning
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Rebuttal Evaluator Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "related_score": 40.0,
            "reasoning": new_reasoning
        }

def evaluate_stance_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg):
        return {}

    topic = state["topic"]
    user = state["current_user"]
    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    opponent_stance = state["user2_stance"] if user == "user1" else state["user1_stance"]

    try:
        res = safe_judge4_call(topic, current_arg, stance, opponent_stance)
        new_reasoning = state["reasoning"] + [f"[Stance Auditor Judge]: {res['reasoning']}"]
        stance_score = float(res["stance_score"])
        
        if res.get("is_violation") and stance_score > config.STANCE_VIOLATION_SCORE_CAP:
            stance_score = config.STANCE_VIOLATION_SCORE_CAP

        return {
            "stance_score": stance_score,
            "reasoning": new_reasoning
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Stance Auditor Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "stance_score": 50.0,
            "reasoning": new_reasoning
        }

def evaluate_delivery_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg):
        return {}

    raw_transcript = state.get("raw_transcript")
    if not raw_transcript or not raw_transcript.strip():
        raw_transcript = current_arg

    import re
    clean_text = re.sub(r'\[.*?\]', '', raw_transcript).strip()
    word_count = len(clean_text.split())

    try:
        res = safe_judge5_call(raw_transcript, word_count)
        new_reasoning = state["reasoning"] + [f"[Delivery Judge]: {res['reasoning']}"]
        return {
            "delivery_score": float(res["delivery_score"]),
            "reasoning": new_reasoning
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Delivery Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "delivery_score": 100.0,
            "reasoning": new_reasoning
        }

def aggregate_scores_node(state: DebateState):
    current_arg = state["current_argument"]
    user = state["current_user"]

    if is_gibberish_or_empty(current_arg):
        updates = {
            "final_score": 0.0,
            "gated": True,
            "stance_gated": True,
            "reasoning": ["All Judges: Argument classified as empty, spam, or gibberish. Automatically scored 0."]
        }
        if user == "user1":
            updates["user1_total"] = round(state["user1_total"] + 0.0, 2)
        else:
            updates["user2_total"] = round(state["user2_total"] + 0.0, 2)
        return updates

    topic = state["topic_score"]
    novelty = state["novelty_score"]
    fact = state["fact_score"]
    related = state["related_score"]

    stance = state.get("stance_score", 50.0)
    delivery = state.get("delivery_score", 100.0)

    word_count = len(current_arg.strip().split())
    opponent = state["user2_args"] if user == "user1" else state["user1_args"]
    
    if word_count < 25:
        fact = min(fact, 35.0)
        topic = min(topic, 60.0)
        if opponent:
            related = min(related, 45.0)
    elif word_count < 50:
        fact = min(fact, 55.0)

    # Apply difficulty scaling if the evaluated argument belongs to the AI opponent
    is_ai = state.get("is_ai") or False
    difficulty = (state.get("difficulty") or "medium").lower()

    if is_ai:
        if difficulty == "easy":
            topic = topic * 0.45
            novelty = novelty * 0.50
            fact = fact * 0.35
            related = related * 0.40
            delivery = delivery * 0.45
            stance = stance * 0.50
        elif difficulty == "medium":
            topic = topic * 0.70
            novelty = novelty * 0.75
            fact = fact * 0.65
            related = related * 0.70
            delivery = delivery * 0.75

    final, topic_gated, stance_gated = compute_final_score(related, novelty, topic, fact, stance, delivery)

    reasonings = list(state["reasoning"])
    if topic_gated:
        reasonings.append(
            f"[SYSTEM - TOPIC GATE TRIGGERED]: Panel topic score ({round(topic, 2)}) fell below "
            f"the {config.TOPIC_GATE_THRESHOLD} threshold. Per real-debate judging standards, an "
            f"off-resolution argument cannot be salvaged by good logic or rebuttal alone, so the "
            f"final score was hard-capped at {config.OFF_TOPIC_FINAL_SCORE_CAP} regardless of other scores."
        )
    if stance_gated:
        reasonings.append(
            f"[SYSTEM - STANCE GATE TRIGGERED]: Stance score ({round(stance, 2)}) fell below "
            f"the {config.STANCE_GATE_THRESHOLD} threshold — the argument did not consistently argue this "
            f"user's assigned side ({state['user1_stance'] if user == 'user1' else state['user2_stance']}). "
            f"Per real-debate judging standards, arguing the wrong side cannot be salvaged by good "
            f"logic or rebuttal alone, so the final score was hard-capped at "
            f"{config.OFF_STANCE_FINAL_SCORE_CAP} regardless of other scores."
        )

    updates = {
        "related_score": round(related, 2),
        "novelty_score": round(novelty, 2),
        "topic_score": round(topic, 2),
        "fact_score": round(fact, 2),
        "stance_score": round(stance, 2),
        "delivery_score": round(delivery, 2),
        "final_score": final,
        "gated": topic_gated,
        "stance_gated": stance_gated,
        "reasoning": reasonings
    }

    if user == "user1":
        updates["user1_total"] = round(state["user1_total"] + final, 2)
    else:
        updates["user2_total"] = round(state["user2_total"] + final, 2)

    return updates


# --- BACKWARD-COMPATIBLE FAÇADE & STATE MANAGEMENT NODES ---

def evaluate_node(state: DebateState) -> dict:
    state = {
        "reasoning": [],
        "related_score": 0.0,
        "novelty_score": 0.0,
        "topic_score": 0.0,
        "fact_score": 0.0,
        "stance_score": 50.0,
        "delivery_score": 100.0,
        "final_score": 0.0,
        "gated": False,
        "stance_gated": False,
        "user1_stance": "FOR",
        "user2_stance": "AGAINST",
        "raw_transcript": "",
        "retrieved_facts": "",
        **state
    }

    # 1. Decide knowledge source strategy
    routing = decide_knowledge_source_node(state)
    state = {**state, **routing}
    
    # 2. Execute RAG / Web Tool if strategy calls for it (respecting confidence-based routing)
    strategy = state.get("knowledge_strategy", "internal")
    confidence = state.get("router_confidence", 1.0)
    
    tool_updates = {}
    if strategy == "rag":
        if confidence < 0.5:
            print(f"[Router Flow] RAG strategy chosen but confidence ({confidence}) is low. Routing to Web Tool...")
            tool_updates = web_search_tool_node(state)
        else:
            tool_updates = rag_tool_node(state)
    elif strategy == "web":
        tool_updates = web_search_tool_node(state)
        
    state = {**state, **tool_updates}

    s1 = evaluate_topic_novelty_node(state)
    state = {**state, **s1}
    
    s2 = evaluate_logic_node(state)
    state = {**state, **s2}
    
    s3 = evaluate_rebuttal_node(state)
    state = {**state, **s3}

    s4 = evaluate_stance_node(state)
    state = {**state, **s4}

    s6 = evaluate_delivery_node(state)
    state = {**state, **s6}

    s5 = aggregate_scores_node(state)
    
    return {**routing, **tool_updates, **s1, **s2, **s3, **s4, **s6, **s5}


def update_history_node(state: DebateState):
    user = state["current_user"]
    arg = state["current_argument"]

    user1_args = list(state["user1_args"])
    user2_args = list(state["user2_args"])

    if user == "user1":
        user1_args.append(arg)
        return {
            "user1_args": user1_args,
            "current_user": "user2"
        }
    else:
        user2_args.append(arg)
        return {
            "user2_args": user2_args,
            "current_user": "user1",
            "current_round": state["current_round"] + 1
        }
