import os
import json
from typing import TypedDict, List, Optional
from statistics import mean
import numpy as np

from langgraph.graph import StateGraph, START, END
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.output_parsers import ResponseSchema, StructuredOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel, Field


# =========================================================
# CONFIG
# =========================================================
# Load environment variables from a local .env file if present
if os.path.exists(".env"):
    with open(".env", "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")

# SECURITY: never hardcode tokens. Set GEMINI_API_KEY / GOOGLE_API_KEY in your shell/.env.
if "GEMINI_API_KEY" not in os.environ and "GOOGLE_API_KEY" not in os.environ:
    raise RuntimeError(
        "Set GEMINI_API_KEY or GOOGLE_API_KEY as an environment variable or in a local .env file before running."
    )

# Standardize key names to avoid warnings from langchain-google-genai
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
elif "GOOGLE_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

if "HUGGINGFACEHUB_API_TOKEN" not in os.environ:
    raise RuntimeError(
        "Set HUGGINGFACEHUB_API_TOKEN as an environment variable or in a local .env file before running (needed for RAG embeddings)."
    )
ROUNDS = 2

# --- TOPIC GATE ---
# If a judge marks the argument off-topic, that judge's TOPIC score is forced
# down to this ceiling, no matter what number the model produced.
OFF_TOPIC_TOPIC_SCORE_CAP = 10.0

# If the panel-AVERAGE topic score falls below this, the FINAL score is hard
# capped (multiplied down) regardless of how good related/novelty/fact were.
# This is the "real debate judge" behavior: being off-topic invalidates
# everything else, it doesn't just get averaged against good logic.
TOPIC_GATE_THRESHOLD = 40.0
OFF_TOPIC_FINAL_SCORE_CAP = 15.0  # final score can never exceed this if gated

# --- STANCE GATE ---
# Each user is assigned a side (FOR / AGAINST) at the start of the debate.
# If the Stance Auditor decides the argument actually argues the OPPOSITE
# side (or undermines its own assigned side), that's a stance violation —
# in real debate this is as fatal as being off-topic, since you can't win
# a round by arguing your opponent's case for them, no matter how logical
# or well-evidenced it is.
STANCE_VIOLATION_SCORE_CAP = 10.0   # cap applied to stance_score on violation
STANCE_GATE_THRESHOLD = 40.0        # below this, stance gate triggers on final score
OFF_STANCE_FINAL_SCORE_CAP = 15.0   # final score can never exceed this if stance-gated

# --- WEIGHTS (used only when neither gate is triggered) ---
# Topic and stance are the two "foundational" checks (does it discuss the
# resolution, does it argue the assigned side). Between them they carry
# almost half the weight; fact and rebuttal quality fill out the rest.
WEIGHTS = {
    "topic": 0.25,
    "stance": 0.25,
    "related": 0.20,
    "fact": 0.25,
    "novelty": 0.05,
}


# =========================================================
# RAG / DUCKDUCKGO INTEGRATION
# =========================================================
_embedding_model = None

def get_embeddings():
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = HuggingFaceEndpointEmbeddings(
            model="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embedding_model

def fetch_topic_facts(topic: str) -> str:
    """
    Queries DuckDuckGo search for the debate topic and combines top search result
    snippets to compile ~500 words of fact-rich summaries. Includes fallback backends.
    """
    try:
        from ddgs import DDGS
        import time
        print(f"[RAG] Querying DuckDuckGo for topic: '{topic}'...")
        
        results = []
        for backend in ["auto", "html", "lite"]:
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(topic, backend=backend, max_results=10))
                    if results:
                        print(f"[RAG] Found search results using backend: '{backend}'")
                        break
            except Exception as inner_e:
                print(f"[RAG] Search backend '{backend}' failed/warned: {inner_e}")
                time.sleep(0.5)
                
        if not results:
            print("[RAG] No search results found across all backends.")
            return ""
        
        text_parts = []
        for r in results:
            title = r.get("title", "")
            body = r.get("body", "")
            if title or body:
                text_parts.append(f"{title}: {body}")
        
        combined_text = "\n\n".join(text_parts)
        word_count = len(combined_text.split())
        print(f"[RAG] Successfully fetched {word_count} words of context from DuckDuckGo.")
        return combined_text
    except Exception as e:
        print(f"[RAG] Error querying DuckDuckGo: {e}")
        return ""


class TopicVectorStore:
    def __init__(self, text: str):
        self.chunks = []
        self.embeddings = []
        if not text.strip():
            return
        
        # 1. Chunking
        splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
        self.chunks = splitter.split_text(text)
        
        if not self.chunks:
            return
        
        # 2. Embeddings via Hugging Face Serverless
        print(f"[RAG] Generating embeddings for {len(self.chunks)} text chunks via Hugging Face...")
        try:
            embeddings_client = get_embeddings()
            self.embeddings = embeddings_client.embed_documents(self.chunks)
            print("[RAG] Embeddings generated successfully.")
        except Exception as e:
            print(f"[RAG] Error generating embeddings: {e}")
            self.embeddings = []

    def retrieve(self, query: str, k: int = 3) -> List[str]:
        if not self.chunks or not self.embeddings:
            return []
        
        try:
            embeddings_client = get_embeddings()
            query_embedding = embeddings_client.embed_query(query)
            
            emb_arr = np.array(self.embeddings)
            query_arr = np.array(query_embedding)
            
            norms = np.linalg.norm(emb_arr, axis=1)
            query_norm = np.linalg.norm(query_arr)
            
            if query_norm == 0 or np.any(norms == 0):
                return self.chunks[:k]
            
            dot_products = np.dot(emb_arr, query_arr)
            similarities = dot_products / (norms * query_norm)
            
            top_k_indices = np.argsort(similarities)[::-1][:k]
            return [self.chunks[idx] for idx in top_k_indices]
        except Exception as e:
            print(f"[RAG] Retrieval failed: {e}")
            return self.chunks[:k]

# Map topic -> TopicVectorStore
_topic_stores = {}

def get_topic_store(topic: str) -> TopicVectorStore:
    if topic not in _topic_stores:
        print(f"[RAG] Initializing vector store for topic: '{topic}'...")
        facts = fetch_topic_facts(topic)
        _topic_stores[topic] = TopicVectorStore(facts)
        print("Retrieved Facts Chunks:")
        if _topic_stores[topic].chunks:
            for idx, chunk in enumerate(_topic_stores[topic].chunks, 1):
                print(f"  {idx}. {chunk}")
        else:
            print("  No chunks retrieved.")
    return _topic_stores[topic]


# =========================================================
# STATE
# =========================================================
class DebateState(TypedDict):
    topic: str
    user1_args: List[str]
    user2_args: List[str]
    user1_stance: str   # "FOR" or "AGAINST"
    user2_stance: str   # always the opposite of user1_stance
    current_round: int
    current_user: str
    current_argument: str

    reasoning: List[str]
    related_score: float
    novelty_score: float
    topic_score: float
    fact_score: float
    stance_score: float
    final_score: float
    gated: bool
    stance_gated: bool

    user1_total: float
    user2_total: float
    retrieved_facts: str


# =========================================================
# LLM SETUP
# =========================================================
llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    temperature=0.2,
    max_output_tokens=2048,
    timeout=60
)


# =========================================================
# STRUCTURED OUTPUT (PANEL SCHEMAS)
# =========================================================
schemas = [
    # Judge 1: Logical Analyst
    ResponseSchema(
        name="judge1_on_topic",
        description="true or false. Does the Current Argument actually discuss the stated Topic?"
    ),
    ResponseSchema(
        name="judge1_reasoning",
        description="Concise (max 2-3 sentences) evaluation by the Logical Analyst justifying the scores."
    ),
    ResponseSchema(name="judge1_related", description="Integer 0-100, strict anchors, for rebuttal/engagement quality."),
    ResponseSchema(name="judge1_novelty", description="Integer 0-100, strict anchors, for uniqueness/non-repetition."),
    ResponseSchema(name="judge1_topic", description="Integer 0-100, strict anchors, for topical relevance."),
    ResponseSchema(name="judge1_fact", description="Integer 0-100, strict anchors, for factual/logical strength."),

    # Judge 2: Rebuttal Evaluator
    ResponseSchema(
        name="judge2_on_topic",
        description="true or false. Does the Current Argument actually discuss the stated Topic?"
    ),
    ResponseSchema(
        name="judge2_reasoning",
        description="Concise (max 2-3 sentences) evaluation by the Rebuttal Evaluator justifying the scores."
    ),
    ResponseSchema(name="judge2_related", description="Integer 0-100, strict anchors, for rebuttal/engagement quality."),
    ResponseSchema(name="judge2_novelty", description="Integer 0-100, strict anchors, for uniqueness/non-repetition."),
    ResponseSchema(name="judge2_topic", description="Integer 0-100, strict anchors, for topical relevance."),
    ResponseSchema(name="judge2_fact", description="Integer 0-100, strict anchors, for factual/logical strength."),

    # Judge 3: Topicality Auditor
    ResponseSchema(
        name="judge3_on_topic",
        description="true or false. Does the Current Argument actually discuss the stated Topic?"
    ),
    ResponseSchema(
        name="judge3_reasoning",
        description="Concise (max 2-3 sentences) evaluation by the Topicality Auditor justifying the scores."
    ),
    ResponseSchema(name="judge3_related", description="Integer 0-100, strict anchors, for rebuttal/engagement quality."),
    ResponseSchema(name="judge3_novelty", description="Integer 0-100, strict anchors, for uniqueness/non-repetition."),
    ResponseSchema(name="judge3_topic", description="Integer 0-100, strict anchors, for topical relevance."),
    ResponseSchema(name="judge3_fact", description="Integer 0-100, strict anchors, for factual/logical strength."),
]

parser = StructuredOutputParser.from_response_schemas(schemas)
format_instructions = parser.get_format_instructions()


# =========================================================
# LOCAL VALIDATION HELPERS
# =========================================================
def is_gibberish_or_empty(text: str) -> bool:
    cleaned = text.strip()
    if not cleaned:
        return True
    if len(cleaned) < 4:
        return True
    words = cleaned.split()
    if len(words) < 2 and len(cleaned) < 15:
        return True
    return False


def format_arguments_list(args: List[str]) -> str:
    if not args:
        return "None (This is the first argument, so there is no history yet)."
    return "\n".join(f"- {arg}" for arg in args)


def safe_float(val, default=50.0) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_bool(val, default=True) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "yes", "1")
    return default


def norm(x) -> float:
    return max(0.0, min(100.0, float(x)))


# =========================================================
# SYSTEM PROMPTS FOR JUDGES
# =========================================================

# Judge 3: Topicality Auditor (Topic & Novelty)
topic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Topicality Auditor (Judge 3), a strict, professional debate judge.

IMPORTANT CONTEXT ON TOPIC TITLES: the debate Topic is often given as a short
title (sometimes just 2-5 words, e.g. "Naruto vs Goku" or "AI regulation").
A short title is shorthand for a broader subject area — it is NOT a literal
keyword checklist. An argument can be solidly on-topic even if it never
repeats the topic's exact wording, as long as it engages with entities,
events, mechanics, causes/effects, or sub-debates that genuinely belong to
that subject area.

Use the TOPIC CONTEXT block below (background facts retrieved about the
topic) to understand the topic's scope BEFORE judging relevance — it tells
you what entities/concepts/sub-debates are actually part of this subject,
so you don't have to guess from the bare title alone. If TOPIC CONTEXT is
empty or unhelpful, fall back to your own general knowledge of the topic's
likely subject area rather than defaulting to "off-topic."

Evaluate strictly on two metrics:
1. **Topic Relevance (TOPIC score, 0-100)**: Does the argument fall within the Topic's subject area?
   - ON-TOPIC (76-100): Engages with entities/mechanics/concepts/sub-debates that are part of this subject area (per TOPIC CONTEXT or general knowledge), or debates an interpretation of the topic itself. Minor spelling errors allowed. The argument does NOT need to repeat the topic's exact words.
   - PARTIALLY RELATED (41-75): Stays in the general domain/neighboring subject but drifts toward a tangential point not clearly tied back to the topic.
   - OFF-TOPIC (0-10): Discusses a subject area unconnected to the topic (different show, different domain, unrelated real-world politics) with no link back.
   - TRIVIAL ARGUMENTS: Capped at 60 if under 25 words, regardless of relevance.
2. **Novelty (NOVELTY score, 0-100)**: Is this a new argument or a repetition of the user's previous arguments?
   - If no previous arguments exist, default to 85.
   - Near-verbatim repeat: 0-20.
   - Same core point reworded: 21-45.
   - Genuinely new line of argument: 71-100.

Output strict JSON matching the schema. Do not write text before or after the JSON.
"""),
    ("human", """Topic: {topic}
TOPIC CONTEXT (background on the topic's subject area — use this to judge scope, not as a fact-check source):
{retrieved_facts}

Current Argument: {current}
Previous Arguments (same user):
{previous}
""")
])

# Judge 1: Logical Analyst (Fact & Logic)
logic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Logical Analyst (Judge 1), a strict, professional debate judge.
Evaluate strictly on **Fact & Logic (FACT score, 0-100)**: logical soundness, structure, reasoning, and evidence verification.
Use the provided RETRIEVED FACTUAL REFERENCE (RAG Context) to verify any factual claims or names.
- CAPPING: under 25 words max 35; under 50 words max 55.
- False or fabricated claims contradicting context: max 20.
- Decent logical structure: 36-55.
- Evidentiary detail/examples: 56-75.
- Airtight reasoning with counter-arguments: 76-100.

Output strict JSON matching the schema. Do not write text before or after the JSON.
"""),
    ("human", """Topic: {topic}
Current Argument: {current}
RETRIEVED FACTUAL REFERENCE (RAG Context):
{retrieved_facts}
""")
])

# Judge 2: Rebuttal Evaluator (Rebuttal & Relatedness)
rebuttal_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Rebuttal Evaluator (Judge 2), a strict, professional debate judge.
Evaluate strictly on **Responsiveness & Rebuttal (RELATED score, 0-100)**: how well does the argument engage with and counter the opponent's arguments?
- If no opponent arguments exist, default to 70.
- Ignores opponent completely: 0-15.
- Vague acknowledgment: 16-35.
- Directly engages and refutes specific points: 56-100.

Output strict JSON matching the schema. Do not write text before or after the JSON.
"""),
    ("human", """Topic: {topic}
Current Argument: {current}
Opponent Arguments:
{opponent}
""")
])

# Judge 4: Stance Auditor (Side Consistency)
stance_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Stance Auditor (Judge 4), a strict, professional debate judge.

In this debate, each user is assigned a side of the resolution BEFORE the
debate starts: FOR (supporting/affirming the topic) or AGAINST (opposing/
negating the topic). Your only job is to check whether the Current
Argument actually argues the user's ASSIGNED SIDE.

This is independent of topic relevance and logical quality — an argument
can be perfectly on-topic and well-reasoned while still arguing the WRONG
side (e.g. the user assigned FOR ends up making the case AGAINST, agreeing
with the opponent, or conceding the opponent's position). That is a stance
violation, just like arguing a different topic entirely would be an
off-topic violation.

Evaluate strictly on **Stance Consistency (STANCE score, 0-100)**:
- CONSISTENT (76-100): Clearly argues in favor of the assigned side; supports it, defends it, or rebuts the opposite side while reinforcing the assigned side.
- MOSTLY CONSISTENT (56-75): Leans toward the assigned side but is hedged, weak, or partially ambiguous about which side it supports.
- AMBIGUOUS / NEUTRAL (30-55): Doesn't clearly commit to either side, or merely restates facts without taking the assigned position.
- VIOLATION (0-20): Clearly argues the OPPOSITE side from the one assigned, concedes the opponent's position, or undermines their own assigned side.
- If the argument is too short/trivial to tell, default to 50 and mark is_violation as false.

You must also output `is_violation`: true if and only if the argument clearly and substantively argues the opposite side of what was assigned (not just weak/hedged support for the right side — that's "MOSTLY CONSISTENT" or "AMBIGUOUS", not a violation).

Output strict JSON matching the schema. Do not write text before or after the JSON.
"""),
    ("human", """Topic: {topic}
This user's assigned side: {stance}
Opponent's assigned side: {opponent_stance}
Current Argument: {current}
""")
])


# =========================================================
# STRUCTURED OUTPUT SCHEMAS & BINDING
# =========================================================
class Judge3Output(BaseModel):
    on_topic: bool = Field(description="true or false. Does the Current Argument discuss the Topic?")
    reasoning: str = Field(description="Concise justification (max 2 sentences) for topic and novelty scores.")
    topic_score: float = Field(description="Score 0-100 for topical relevance.")
    novelty_score: float = Field(description="Score 0-100 for novelty relative to previous arguments.")

class Judge1Output(BaseModel):
    reasoning: str = Field(description="Concise justification (max 2 sentences) for logical consistency/fact score.")
    fact_score: float = Field(description="Score 0-100 for logical strength and fact verification.")

class Judge2Output(BaseModel):
    reasoning: str = Field(description="Concise justification (max 2 sentences) for relatedness/rebuttal score.")
    related_score: float = Field(description="Score 0-100 for rebuttal/engagement.")

class Judge4Output(BaseModel):
    is_violation: bool = Field(description="true if the argument clearly argues the opposite of the user's assigned side.")
    reasoning: str = Field(description="Concise justification (max 2 sentences) for the stance score.")
    stance_score: float = Field(description="Score 0-100 for how consistent the argument is with the user's assigned side.")

# Bind structured output to the model
judge3_llm = llm.with_structured_output(Judge3Output)
judge1_llm = llm.with_structured_output(Judge1Output)
judge2_llm = llm.with_structured_output(Judge2Output)
judge4_llm = llm.with_structured_output(Judge4Output)


def safe_judge3_call(topic, current, previous, retrieved_facts) -> dict:
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

def safe_judge1_call(topic, current, retrieved_facts) -> dict:
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

def safe_judge2_call(topic, current, opponent) -> dict:
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

def safe_judge4_call(topic, current, stance, opponent_stance) -> dict:
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
        # Fail open (assume no violation) on error, same philosophy as the
        # other judges' fallbacks — an LLM/API hiccup shouldn't tank a user's
        # score, so default to a neutral-ish passing value.
        return {
            "is_violation": False,
            "reasoning": f"Judge 4 Fallback due to error: {str(e)[:100]}",
            "stance_score": 50.0
        }


def enforce_topic_consistency(res: dict) -> dict:
    """
    Code-level guardrail: if a judge said on_topic=False but still gave a topic
    score above the cap (model self-contradiction — common in smaller LLMs),
    force that judge's topic score down to the cap. We never trust the raw
    number alone; the stated verdict is authoritative.
    """
    for j in ("judge1", "judge2", "judge3"):
        on_topic = safe_bool(res.get(f"{j}_on_topic"), default=True)
        topic_score = safe_float(res.get(f"{j}_topic"))
        if not on_topic and topic_score > OFF_TOPIC_TOPIC_SCORE_CAP:
            res[f"{j}_topic"] = OFF_TOPIC_TOPIC_SCORE_CAP
    return res


def compute_final_score(related: float, novelty: float, topic: float, fact: float, stance: float):
    """
    Real-debate-judge scoring logic:

    - Topic relevance and Stance consistency are checked FIRST as GATES.
      If either falls below its threshold, the argument is treated as
      fundamentally broken at a foundational level (wrong subject, or
      arguing the wrong side) — in real debate, neither can be salvaged by
      good logic or rebuttal, so the final score is hard-capped, scaled
      down further by just how bad the violation was (so a 39 still does
      slightly better than a 5, but both stay capped low).
      If BOTH gates trigger, the stricter (lower) cap wins.

    - If neither gate triggers, the final score is a weighted average
      using WEIGHTS, where topic and stance together carry half the
      weight, reflecting that "right subject, right side" is the
      foundation everything else builds on.

    Returns (final_score, topic_gated: bool, stance_gated: bool).
    """
    # Calculate the regular weighted score first
    weighted = (
        WEIGHTS["topic"] * topic +
        WEIGHTS["stance"] * stance +
        WEIGHTS["related"] * related +
        WEIGHTS["fact"] * fact +
        WEIGHTS["novelty"] * novelty
    )

    topic_gated = topic < TOPIC_GATE_THRESHOLD
    stance_gated = stance < STANCE_GATE_THRESHOLD

    if not topic_gated and not stance_gated:
        return round(norm(weighted), 2), False, False

    caps = []
    if topic_gated:
        severity = topic / TOPIC_GATE_THRESHOLD  # 0.0 (completely off) to 1.0 (right at the edge)
        caps.append(OFF_TOPIC_FINAL_SCORE_CAP * severity)
    if stance_gated:
        severity = stance / STANCE_GATE_THRESHOLD
        caps.append(OFF_STANCE_FINAL_SCORE_CAP * severity)

    # Whichever gate is more severe wins (lower cap applies)
    cap = min(caps)
    final_score = min(weighted, cap)
    return round(norm(final_score), 2), topic_gated, stance_gated


# =========================================================
# GRAPH NODES
# =========================================================
def get_input_node(state: DebateState):
    user = state["current_user"]
    if user == "user1":
        print(f"\n=== ROUND {state['current_round']} ===")

    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    arg = input(f"{user} ({stance}) argument: ")
    return {"current_argument": arg}


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

    # Fetch history
    previous = state["user1_args"] if state["current_user"] == "user1" else state["user2_args"]
    previous = previous[-3:]
    previous_formatted = format_arguments_list(previous)

    # Build/reuse the topic's RAG store now (was previously only built in the
    # logic node, which runs AFTER this one — meaning the topicality judge
    # used to have to guess at a short topic title with zero context). We
    # retrieve against the topic itself (broad scope) rather than the
    # argument, since the goal here is "what does this topic cover", not
    # "verify this specific claim".
    store = get_topic_store(topic)
    scope_chunks = store.retrieve(topic, k=4)
    if scope_chunks:
        retrieved_context = "\n".join(f"- {chunk}" for chunk in scope_chunks)
    else:
        retrieved_context = "No additional context retrieved for this topic; rely on general knowledge of its likely subject area."

    try:
        res = safe_judge3_call(topic, current_arg, previous_formatted, retrieved_context)
        return {
            "topic_score": float(res["topic_score"]),
            "novelty_score": float(res["novelty_score"]),
            "reasoning": [f"[Topicality Auditor Judge]: {res['reasoning']}"],
            "gated": not res["on_topic"],
            "retrieved_facts": retrieved_context
        }
    except Exception as e:
        return {
            "topic_score": 40.0,
            "novelty_score": 40.0,
            "reasoning": [f"[Topicality Auditor Judge]: Fallback triggered due to error: {str(e)[:100]}"],
            "gated": False,
            "retrieved_facts": retrieved_context
        }


def evaluate_logic_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg) or state.get("gated", False):
        return {}

    topic = state["topic"]
    
    # Retrieve facts
    store = get_topic_store(topic)
    retrieved_chunks = store.retrieve(current_arg, k=3)
    if retrieved_chunks:
        retrieved_context = "\n".join(f"- {chunk}" for chunk in retrieved_chunks)
    else:
        retrieved_context = "No additional factual reference retrieved."

    try:
        res = safe_judge1_call(topic, current_arg, retrieved_context)
        
        # Append reasoning
        new_reasoning = state["reasoning"] + [f"[Logical Analyst Judge]: {res['reasoning']}"]
        return {
            "fact_score": float(res["fact_score"]),
            "reasoning": new_reasoning,
            "retrieved_facts": retrieved_context
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Logical Analyst Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "fact_score": 40.0,
            "reasoning": new_reasoning,
            "retrieved_facts": retrieved_context
        }


def evaluate_rebuttal_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg) or state.get("gated", False):
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
    if is_gibberish_or_empty(current_arg) or state.get("gated", False):
        return {}

    topic = state["topic"]
    user = state["current_user"]
    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    opponent_stance = state["user2_stance"] if user == "user1" else state["user1_stance"]

    try:
        res = safe_judge4_call(topic, current_arg, stance, opponent_stance)

        new_reasoning = state["reasoning"] + [f"[Stance Auditor Judge]: {res['reasoning']}"]
        stance_score = float(res["stance_score"])
        # Code-level guardrail, same philosophy as enforce_topic_consistency:
        # if the judge flagged a clear violation but still gave a score above
        # the cap (model self-contradiction), force it down. The stated
        # verdict is authoritative, not the raw number.
        if res.get("is_violation") and stance_score > STANCE_VIOLATION_SCORE_CAP:
            stance_score = STANCE_VIOLATION_SCORE_CAP

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

    # If the topic gate already fired in evaluate_topic_novelty_node, then
    # evaluate_logic/evaluate_rebuttal/evaluate_stance all short-circuited
    # with {} and never touched fact/related/stance_score for THIS turn —
    # those fields would otherwise still hold stale values from a previous
    # turn's state. Treat them as neutral/unscored rather than trusting
    # leftover numbers.
    already_gated_for_topic = state.get("gated", False)
    if already_gated_for_topic:
        fact = 0.0
        related = 0.0
        stance = 50.0  # unscored — neutral, not a violation
    else:
        stance = state.get("stance_score", 50.0)

    # Code-level safeguards for short/uninformative arguments
    word_count = len(current_arg.strip().split())
    opponent = state["user2_args"] if user == "user1" else state["user1_args"]
    
    if word_count < 25:
        fact = min(fact, 35.0)
        topic = min(topic, 60.0)
        if opponent:
            related = min(related, 45.0)
    elif word_count < 50:
        fact = min(fact, 55.0)

    # Calculate final score and check both gates
    final, topic_gated, stance_gated = compute_final_score(related, novelty, topic, fact, stance)

    reasonings = list(state["reasoning"])
    if topic_gated:
        reasonings.append(
            f"[SYSTEM - TOPIC GATE TRIGGERED]: Panel topic score ({round(topic, 2)}) fell below "
            f"the {TOPIC_GATE_THRESHOLD} threshold. Per real-debate judging standards, an "
            f"off-resolution argument cannot be salvaged by good logic or rebuttal alone, so the "
            f"final score was hard-capped at {OFF_TOPIC_FINAL_SCORE_CAP} regardless of other scores."
        )
    if stance_gated:
        reasonings.append(
            f"[SYSTEM - STANCE GATE TRIGGERED]: Stance score ({round(stance, 2)}) fell below "
            f"the {STANCE_GATE_THRESHOLD} threshold — the argument did not consistently argue this "
            f"user's assigned side ({state['user1_stance'] if user == 'user1' else state['user2_stance']}). "
            f"Per real-debate judging standards, arguing the wrong side cannot be salvaged by good "
            f"logic or rebuttal alone, so the final score was hard-capped at "
            f"{OFF_STANCE_FINAL_SCORE_CAP} regardless of other scores."
        )

    updates = {
        "related_score": round(related, 2),
        "novelty_score": round(novelty, 2),
        "topic_score": round(topic, 2),
        "fact_score": round(fact, 2),
        "stance_score": round(stance, 2),
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


def evaluate_node(state: DebateState) -> dict:
    """
    Facade function for backward compatibility with server.py and test_scenarios.py.
    Sequentially runs the new multi-node evaluation pipeline and returns the merged state updates.
    """
    # 1. Run topic and novelty
    s1 = evaluate_topic_novelty_node(state)
    state = {**state, **s1}
    
    # 2. Run logic
    s2 = evaluate_logic_node(state)
    state = {**state, **s2}
    
    # 3. Run rebuttal
    s3 = evaluate_rebuttal_node(state)
    state = {**state, **s3}

    # 4. Run stance
    s4 = evaluate_stance_node(state)
    state = {**state, **s4}

    # 5. Run aggregate
    s5 = aggregate_scores_node(state)
    
    # Merge all updates
    return {**s1, **s2, **s3, **s4, **s5}


def display_scores_node(state: DebateState):
    user = state["current_user"]
    stance = state["user1_stance"] if user == "user1" else state["user2_stance"]
    print(f"\n--- SCORES ({user}, arguing {stance}) ---")
    print("Topic:  ", state["topic_score"], "(gate)")
    print("Stance: ", state["stance_score"], "(gate)")
    print("Related:", state["related_score"])
    print("Fact:   ", state["fact_score"])
    print("Novelty:", state["novelty_score"])

    flags = []
    if state.get("gated"):
        flags.append("TOPIC GATE")
    if state.get("stance_gated"):
        flags.append("STANCE GATE")

    if flags:
        print(f"Final:  {state['final_score']}  ⚠ {' + '.join(flags)} TRIGGERED")
    else:
        print("Final:  ", state["final_score"])

    print("\n--- JUDGES' REASONINGS ---")
    for reason in state.get("reasoning", []):
        print(reason)
    print("---------------------------")
    return {}


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


def final_result_node(state: DebateState):
    print("\n===== FINAL RESULT =====")
    print("User1:", round(state["user1_total"], 2))
    print("User2:", round(state["user2_total"], 2))

    if state["user1_total"] > state["user2_total"]:
        print("Winner: User1")
    elif state["user2_total"] > state["user1_total"]:
        print("Winner: User2")
    else:
        print("Draw")
    return {}


# =========================================================
# GRAPH ARCHITECTURE
# =========================================================
graph = StateGraph(DebateState)

graph.add_node("get_input", get_input_node)
graph.add_node("evaluate_topic_novelty", evaluate_topic_novelty_node)
graph.add_node("evaluate_logic", evaluate_logic_node)
graph.add_node("evaluate_rebuttal", evaluate_rebuttal_node)
graph.add_node("evaluate_stance", evaluate_stance_node)
graph.add_node("aggregate_scores", aggregate_scores_node)
graph.add_node("display_scores", display_scores_node)
graph.add_node("update_history", update_history_node)
graph.add_node("final_result", final_result_node)

graph.add_edge(START, "get_input")
graph.add_edge("get_input", "evaluate_topic_novelty")
graph.add_edge("evaluate_topic_novelty", "evaluate_logic")
graph.add_edge("evaluate_logic", "evaluate_rebuttal")
graph.add_edge("evaluate_rebuttal", "evaluate_stance")
graph.add_edge("evaluate_stance", "aggregate_scores")
graph.add_edge("aggregate_scores", "display_scores")
graph.add_edge("display_scores", "update_history")


def route_next(state: DebateState):
    if state["current_round"] > ROUNDS:
        return "final_result"
    return "get_input"


graph.add_conditional_edges(
    "update_history",
    route_next,
    {
        "get_input": "get_input",
        "final_result": "final_result"
    }
)

graph.add_edge("final_result", END)

workflow = graph.compile()


# =========================================================
# GAME LOOP (TRIGGER)
# =========================================================
def play():
    topic = input("Enter debate topic: ")

    # Ask User1 to pick a side. User2 automatically gets the opposite side —
    # this is how real debate works: you don't choose your own side AND
    # your opponent's, the sides are complementary by definition.
    while True:
        choice = input("User1 — pick your stance (FOR / AGAINST): ").strip().upper()
        if choice in ("FOR", "AGAINST"):
            user1_stance = choice
            break
        print("Please type 'FOR' or 'AGAINST'.")

    user2_stance = "AGAINST" if user1_stance == "FOR" else "FOR"
    print(f"User1 is arguing {user1_stance}. User2 is arguing {user2_stance}.\n")

    initial_state = {
        "topic": topic,
        "user1_args": [],
        "user2_args": [],
        "user1_stance": user1_stance,
        "user2_stance": user2_stance,
        "current_round": 1,
        "current_user": "user1",
        "current_argument": "",
        "reasoning": [],
        "related_score": 0.0,
        "novelty_score": 0.0,
        "topic_score": 0.0,
        "fact_score": 0.0,
        "stance_score": 0.0,
        "final_score": 0.0,
        "gated": False,
        "stance_gated": False,
        "user1_total": 0.0,
        "user2_total": 0.0,
        "retrieved_facts": ""
    }

    workflow.invoke(initial_state)


if __name__ == "__main__":
    play()