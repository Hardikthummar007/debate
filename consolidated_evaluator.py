import os
import re
import json
import asyncio
from typing import TypedDict, List, Optional
from pydantic import BaseModel, Field

# LangChain Imports
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

# =====================================================================
# 1. ENVIRONMENT & API SETUP
# =====================================================================

def load_env():
    # Attempt to load .env from the working directory or parent directories
    env_paths = [".env", "../.env"]
    for path in env_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip().strip('"').strip("'")
            break

load_env()

# Sync Gemini API key names to satisfy both SDKs
if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
elif "GOOGLE_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

if "GOOGLE_API_KEY" not in os.environ:
    raise RuntimeError("Missing GOOGLE_API_KEY/GEMINI_API_KEY in environment or .env file.")

# =====================================================================
# 2. CONFIGURATION CONSTANTS
# =====================================================================

ROUNDS = 2

# --- GATING CONSTANTS ---
TOPIC_GATE_THRESHOLD = 40.0
OFF_TOPIC_FINAL_SCORE_CAP = 30.0
OFF_TOPIC_TOPIC_SCORE_CAP = 10.0

STANCE_GATE_THRESHOLD = 40.0
OFF_STANCE_FINAL_SCORE_CAP = 30.0
STANCE_VIOLATION_SCORE_CAP = 10.0

# --- WEIGHTS (Must sum to 1.0) ---
WEIGHTS = {
    "topic": 0.10,      # Topicality / Relevance
    "stance": 0.25,     # Stance Consistency
    "related": 0.20,    # Rebuttal / Clash
    "fact": 0.25,       # Logic / Argument Strength
    "novelty": 0.10,    # Novelty / Originality
    "delivery": 0.10,   # Clarity / Pacing Delivery
}

# =====================================================================
# 3. TYPED STATE STRUCTURE
# =====================================================================

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
    is_ai: Optional[bool]
    difficulty: Optional[str]
    raw_transcript: Optional[str]
    retrieved_facts: Optional[str]

# =====================================================================
# 4. UTILITIES & TRANSLATION HELPERS
# =====================================================================

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
    try:
        return max(0.0, min(100.0, float(x)))
    except (ValueError, TypeError):
        return 50.0

# =====================================================================
# 5. STRUCTURED SCHEMAS FOR PARSING
# =====================================================================

class Judge3Schema(BaseModel):
    topic_reasoning: str = Field(description="Step-by-step reasoning assessing if argument fits topic context.")
    topic_score: int = Field(description="Topic score from 0 to 100 based on rubric.")
    novelty_reasoning: str = Field(description="Step-by-step comparison to previous arguments.")
    novelty_score: int = Field(description="Novelty score from 0 to 100 based on rubric.")

class Judge1Schema(BaseModel):
    fact_reasoning: str = Field(description="Assess logical chain and verify claims against RAG and knowledge.")
    fact_score: int = Field(description="Fact & Logic score from 0 to 100.")

class Judge2Schema(BaseModel):
    rebuttal_reasoning: str = Field(description="Evaluate clash against opponent claims.")
    rebuttal_score: int = Field(description="Rebuttal & Responsiveness score from 0 to 100.")

class Judge4Schema(BaseModel):
    stance_reasoning: str = Field(description="Compare user argument stance to their assigned side.")
    stance_score: int = Field(description="Stance score from 0 to 100.")
    is_violation: bool = Field(description="Set to true ONLY if score is 25 or below (arguing opposite side).")

class Judge5Schema(BaseModel):
    delivery_reasoning: str = Field(description="Justify scores using density of filler words, repetitions, restarts, and pauses.")
    delivery_score: int = Field(description="Delivery and Fluency score from 0 to 100.")

class RouterSchema(BaseModel):
    router_reason: str = Field(description="Explain routing strategy choice based on claim specificity.")
    knowledge_strategy: str = Field(description="Choose 'internal', 'rag', or 'web'.")
    search_query: str = Field(description="Specific web search query, empty if 'internal'.")
    router_confidence: float = Field(description="Confidence from 0.0 to 1.0.")

# =====================================================================
# 6. LLM MODELS INITIALIZATION
# =====================================================================

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.0)

# Specialized structured model instances
router_llm = llm.with_structured_output(RouterSchema)
judge1_llm = llm.with_structured_output(Judge1Schema)
judge2_llm = llm.with_structured_output(Judge2Schema)
judge3_llm = llm.with_structured_output(Judge3Schema)
judge4_llm = llm.with_structured_output(Judge4Schema)
judge5_llm = llm.with_structured_output(Judge5Schema)

# =====================================================================
# 7. PROMPT TEMPLATES
# =====================================================================

router_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Knowledge Router for an AI debate system.
Your job is to read the current argument and topic, and decide which source of knowledge is required to evaluate its factual claims.

CRITICAL TEMPORAL & SPECIFICITY RULES:
1. Current Date: The current year is 2026. Your internal pre-trained knowledge has a cutoff date before 2026.
2. If the argument mentions dates, years (especially 2025 or 2026), "recently", or specific recent/current updates, stats, or developments, you MUST select 'web'. You cannot verify 2025 or 2026 facts internally.
3. If the argument cites specific companies, releases, frameworks, or updates (e.g., "Anthropic's five-stage AI adoption framework"), you MUST select 'web' (or 'rag' if it is standard topic-specific material) to fetch verification details. Do not guess using internal knowledge.
4. 'internal': ONLY use this when the argument is purely philosophical, logical reasoning, general/common knowledge, well-known historical facts (pre-2024), or subjective/ethical claims that require no search.
5. 'rag': Use this when the claim requires specific domain knowledge related to the main topic (standard definitions, established rules, or basic topic facts) that should be in our topic reference base.
6. 'web': Use this for live web search queries when the claim relies on specific numbers, recent statistics, current news, local laws, specific quotes, or niche frameworks.

Output a valid JSON matching the schema.
"""),
    ("human", """Topic: {topic}
Current Argument: {current}
""")
])

logic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Logical Analyst (Judge 1), a strict, professional debate judge.
Your goal is to evaluate the argument strictly on **Fact & Logic (0-100)**: logical soundness, structure, reasoning, and evidence.

### 🧠 KNOWLEDGE & FACT VERIFICATION RULES:
You are provided with a RETRIEVED FACTUAL REFERENCE (RAG Context). Use it to verify the factual claims made in the argument:
1. **VERIFY WITH PROVIDED CONTEXT:** If the claim involves specific facts, statistics, or details, verify them using the provided RAG Context.
2. **FALL BACK TO INTERNAL KNOWLEDGE:** If the RAG Context explicitly instructs you to rely on general knowledge/internal knowledge, or if the RAG Context is empty or does not address the claim, evaluate the claim using your own trained internal knowledge.
3. **UNVERIFIABLE CLAIMS:** If neither your internal knowledge nor the RAG Context can verify the claim, DO NOT penalize it. Judge it purely on its logical structure (plausibility, internal consistency).
4. **THIN/GENERIC RAG IS NOT A CONTRADICTION:** A RAG chunk that is merely thin, generic, or off-target is NOT evidence the claim is false. Only apply a severe penalty if the claim is explicitly contradicted by EITHER your confident internal knowledge OR a direct quote in the RAG Context.

### 📊 SCORING RUBRIC (0-100)
- **[0-20] Factually False / Nonsense:** The core claim is demonstrably false/fabricated, or the argument lacks any logical structure (e.g., gibberish).
- **[21-45] Structurally Weak / Unsubstantiated:** The argument is a bare assertion without premises (e.g., "Blue is better because it just is.").
- **[46-75] Logically Sound but Basic:** Contains clear premises leading to a conclusion. May lack deep empirical evidence but is logically coherent and plausible.
- **[76-100] Airtight & Evidentiary:** Flawless logic chain, supported by specific examples, analogies, or data. Anticipates and structuralizes against logical fallacies.

### ⚠️ OUTPUT FORMAT
You must output ONLY a valid JSON object matching the structured schema.
"""),
    ("human", """Topic: {topic}
Current Argument: {current}
RETRIEVED FACTUAL REFERENCE (RAG Context):
{retrieved_facts}""")
])

rebuttal_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Rebuttal Evaluator (Judge 2), a strict, professional debate judge.
Your goal is to evaluate strictly on **Responsiveness & Rebuttal (0-100)**: how effectively does the argument engage with, clash against, and counter the opponent's previous arguments?

### 🎯 REBUTTAL RULES
A strong rebuttal does not just say "the opponent is wrong." It specifically attacks the opponent's *premise*, their *evidence*, or the *impact* of their claim. 
If no Opponent Arguments exist, automatically assign a score of 70 (unless the Current Argument is completely off-topic or nonsense/gibberish, in which case assign a score of 0) and note it in the reasoning.

### 📊 SCORING RUBRIC (0-100)
- **[0-20] Total Evasion / Gibberish:** Ignores the opponent's argument completely, or provides unreadable nonsense.
- **[21-45] Vague Acknowledgment / Ship Passing:** Mentions the opponent or their general theme, but does not address the specific logic of their argument.
- **[46-75] Direct Clash:** Explicitly references the opponent's specific claim and provides a counter-argument or counter-evidence.
- **[76-100] Surgical Refutation:** Deconstructs the opponent's argument by exposing logical fallacies, attacking their specific evidence, or flipping their impact.

### ⚠️ OUTPUT FORMAT
You must output ONLY a valid JSON object matching the structured schema.
"""),
    ("human", """Topic: {topic}
Opponent Arguments:
{opponent}

Current Argument: {current}""")
])

topic_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Topicality Auditor (Judge 3), a strict, professional debate judge.
Your goal is to evaluate the argument on **Topic Relevance (0-100)** and **Novelty (0-100)**.

### 🧭 TOPICALITY RULES
IMPORTANT CONTEXT ON TOPIC TITLES: The debate Topic is often given as a short title. This is shorthand for a broader subject area — it is NOT a literal keyword checklist. An argument can be solidly on-topic even if it never repeats the topic's exact wording, as long as it engages with entities, events, mechanics, causes/effects, or sub-debates that genuinely belong to that subject area. Use the TOPIC CONTEXT to understand this scope.

### 📊 SCORING RUBRIC (0-100)
**Topic Score:**
- **[0-20] Off-Topic:** Discusses a completely unrelated subject area. No logical link to the debate topic, or complete gibberish.
- **[21-60] Tangential / Trivial:** Drifts significantly away from the core subject into unrelated domains, OR the argument is so short/trivial that it barely engages with the topic.
- **[61-100] On-Topic:** Squarely addresses the subject area, sub-debates, or mechanics of the topic.

**Novelty Score:**
- If no previous arguments exist from this user, score 85 (unless the Current Argument is completely off-topic/nonsense, in which case score 0).
- **[0-30] Near-Verbatim Repeat:** Copy-pastes or slightly alters the exact same sentences they already used.
- **[31-65] Same Core Point, Reworded:** Argues the exact same logical premise as before, just using different phrasing.
- **[66-100] Genuinely New:** Introduces a new angle, new premise, or new sub-topic they haven't used yet.

### ⚠️ OUTPUT FORMAT
You must output ONLY a valid JSON object matching the structured schema.
"""),
    ("human", """Topic: {topic}
TOPIC CONTEXT (Background facts on the subject area):
{retrieved_facts}

Previous Arguments (same user):
{previous}

Current Argument: {current}""")
])

stance_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Stance Auditor (Judge 4), a strict, professional debate judge.
Your ONLY job is to check whether the Current Argument argues the user's **ASSIGNED SIDE** (FOR or AGAINST the topic). 

### ⚖️ STANCE RULES
This is independent of logical quality. An argument can be perfectly on-topic and well-reasoned while still arguing the WRONG side. 
- **FOR:** Supports, affirms, or defends the topic resolution.
- **AGAINST:** Opposes, negates, or critiques the topic resolution.

### 📊 SCORING RUBRIC (0-100)
- **[0-25] VIOLATION / OPPOSITE SIDE:** The user explicitly argues the opponent's side, completely concedes the opponent's position, directly undermines their own assigned side, or provides completely off-topic nonsense/gibberish.
- **[26-55] Ambiguous / Neutral:** Restates facts without taking a stance. It is unclear which side they are on. (If extremely short, default to 50. If completely off-topic nonsense, treat as a violation under the 0-25 range).
- **[56-80] Mostly Consistent:** Leans toward their assigned side but contains hedged language or unnecessary concessions.
- **[81-100] Locked In:** Clearly and unequivocally argues in favor of their assigned side.

### 🚨 VIOLATION FLAG
You must output a boolean `is_violation`. Set this to `true` ONLY if the score is 25 or below (i.e., they argued the wrong side, or failed to argue the assigned side by providing nonsense). Weakness or ambiguity (`false`) is not a violation.

### ⚠️ OUTPUT FORMAT
You must output ONLY a valid JSON object matching the structured schema.
"""),
    ("human", """Topic: {topic}
This user's assigned side: {stance}
Opponent's assigned side: {opponent_stance}

Current Argument: {current}""")
])

delivery_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are the Delivery Judge (Judge 5), a strict but fair and understanding debate
judge who evaluates HOW an argument was spoken — not what it says. You are
given a STRUCTURED JSON transcript of the spoken argument that records the
exact timing of each word segment and the pauses after them:

{{
  "text": "...",
  "segments": [
    {{
      "text": "word",
      "start": relative_start_seconds,
      "end": relative_end_seconds,
      "pause_after": pause_seconds_after_this_word
    }}
  ]
}}

You do NOT evaluate logical content, factual accuracy, topic relevance, or
stance — other judges handle those. Judge ONLY delivery quality: fluency,
pacing, and conversational naturalness.

IMPORTANT CALIBRATION & LENIENCY RULE: 
- Be forgiving. Human speech is naturally conversational, and speakers need time to collect thoughts, structure ideas, or restart a word or brief phrase.
- A score of 35 is far too harsh for general pauses. Do NOT drop the score below 60 unless there is extreme, prolonged silence (e.g. constant 15+ second pauses) or total breakdown of coherent flow.
- Treat brief pauses (even up to 5-10 seconds) as a minor/moderate structural hesitation, keeping scores in the 65-80 range if the rest of the text reads coherently and fluently.
- Stuttered starts ("if you are if you are") are natural and should be penalized very lightly (-5 points maximum).

Compute these sub-signals from the JSON segments first, then derive the final DELIVERY score:

1. **Filler density** = (count of filler words like "um", "uh", "er" plus crutch words like "like", "basically", "you know", "I mean" in text segments) / total spoken words.
   - <5%: negligible, natural speech. No penalty.
   - 5-10%: mild, occasional. Minor penalty.
   - 10-15%: noticeable, recurring crutch reliance. Moderate penalty.
   - >15%: heavy, disrupts comprehension. Severe penalty.

2. **Repetition pattern** = count of near-duplicate consecutive word/phrase segments.
   - 0-2 repeats: normal self-correction, very minor penalty (-5 at most).
   - 3+: moderate penalty.

3. **Restart frequency** = instances where a sentence is abandoned mid-way and started over.
   - 0-2 restarts: normal, minor penalty.
   - 3+: moderate penalty.

4. **Pause pattern** = distribution of `pause_after` values in the segments.
   - Pauses < 2.0s: natural breathing/thinking, no penalty.
   - Pauses 2.0-5.0s: mild penalty (-5 points per instance).
   - Pauses > 5.0s: moderate penalty (-10 points per instance). Even with multiple long pauses, do not drop the final score below 60 if the text is cohesive.

SCORING ANCHORS (0-100), applied AFTER weighing all signals:
- 85-100 (FLUENT): Natural conversational speech, occasional brief restarts or pauses.
- 70-84 (MOSTLY FLUENT): A few noticeable pauses (e.g. 5-20s) or repetitions, but overall speech is fully understandable.
- 55-69 (MODERATE DISFLUENCY): Multiple significant pauses or frequent repetitions, but speech is still cohesive.
- 30-54 (STRUGGLING): Heavy disfluency, extreme pauses, or high filler density that actively blocks understanding.
- 0-29 (BREAKDOWN): Complete silence or total verbal breakdown.

EDGE CASES:
- If `segments` is empty or extremely short (under 10 words), score in the 65-75 range (insufficient signal, not a penalty).
- Never let content quality leak into this score.

Output strict JSON matching the schema. Do not write text before or after the JSON.
"""),
    ("human", """Structured JSON transcript:
{raw_transcript}

Total spoken word count: {word_count}
""")
])

# =====================================================================
# 8. SAFE JUDGE API WRAPPERS
# =====================================================================

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
            "on_topic": res.topic_score >= TOPIC_GATE_THRESHOLD,
            "reasoning": res.topic_reasoning + " | " + res.novelty_reasoning,
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
            "reasoning": res.fact_reasoning,
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
            "reasoning": res.rebuttal_reasoning,
            "rebuttal_score": res.rebuttal_score
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 2 Fallback due to error: {str(e)[:100]}",
            "rebuttal_score": 40.0
        }

def safe_judge4_call(topic: str, current: str, stance: str, opponent_stance: str) -> dict:
    try:
        messages = stance_prompt.format_messages(
            topic=topic,
            stance=stance,
            opponent_stance=opponent_stance,
            current=current
        )
        res = judge4_llm.invoke(messages)
        return {
            "reasoning": res.stance_reasoning,
            "stance_score": res.stance_score,
            "is_violation": res.is_violation
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 4 Fallback due to error: {str(e)[:100]}",
            "stance_score": 40.0,
            "is_violation": False
        }

def safe_judge5_call(raw_transcript: str, word_count: int) -> dict:
    try:
        messages = delivery_prompt.format_messages(
            raw_transcript=raw_transcript,
            word_count=word_count
        )
        res = judge5_llm.invoke(messages)
        return {
            "reasoning": res.delivery_reasoning,
            "delivery_score": res.delivery_score
        }
    except Exception as e:
        return {
            "reasoning": f"Judge 5 Fallback due to error: {str(e)[:100]}",
            "delivery_score": 100.0
        }

# =====================================================================
# 9. LANGGRAPH STATE NODES
# =====================================================================

def decide_knowledge_source_node(state: DebateState):
    topic = state["topic"]
    current_arg = state["current_argument"]
    
    if is_gibberish_or_empty(current_arg):
        return {
            "knowledge_strategy": "internal",
            "router_reason": "Argument is empty or gibberish; routing to internal to bypass search.",
            "search_query": "",
            "router_confidence": 1.0
        }

    try:
        messages = router_prompt.format_messages(topic=topic, current=current_arg)
        res = router_llm.invoke(messages)
        return {
            "knowledge_strategy": res.knowledge_strategy,
            "router_reason": res.router_reason,
            "search_query": res.search_query,
            "router_confidence": res.router_confidence
        }
    except Exception as e:
        return {
            "knowledge_strategy": "internal",
            "router_reason": f"Fallback triggered due to router error: {str(e)[:100]}",
            "search_query": "",
            "router_confidence": 1.0
        }

def evaluate_topic_novelty_node(state: DebateState):
    current_arg = state["current_argument"]
    if is_gibberish_or_empty(current_arg):
        return {}

    topic = state["topic"]
    user = state["current_user"]
    previous_list = state["user1_args"] if user == "user1" else state["user2_args"]
    previous_formatted = format_arguments_list(previous_list)
    retrieved_context = state.get("retrieved_facts", "").strip()

    if not retrieved_context:
        retrieved_context = "No additional factual reference retrieved."

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
    user = state["current_user"]
    opponent_list = state["user2_args"] if user == "user1" else state["user1_args"]
    opponent_formatted = format_arguments_list(opponent_list)

    try:
        res = safe_judge2_call(topic, current_arg, opponent_formatted)
        new_reasoning = state["reasoning"] + [f"[Rebuttal Evaluator Judge]: {res['reasoning']}"]
        return {
            "related_score": float(res["rebuttal_score"]),
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
        return {
            "stance_score": float(res["stance_score"]),
            "stance_gated": res["is_violation"],
            "reasoning": new_reasoning
        }
    except Exception as e:
        new_reasoning = state["reasoning"] + [f"[Stance Auditor Judge]: Fallback triggered due to error: {str(e)[:100]}"]
        return {
            "stance_score": 40.0,
            "stance_gated": False,
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

# =====================================================================
# 10. SCORE AGGREGATION & GATING LOGIC
# =====================================================================

def compute_final_score(related: float, novelty: float, topic: float, fact: float, stance: float, delivery: float):
    # Calculate the regular weighted score first
    weighted = (
        WEIGHTS["topic"] * topic +
        WEIGHTS["stance"] * stance +
        WEIGHTS["related"] * related +
        WEIGHTS["fact"] * fact +
        WEIGHTS["novelty"] * novelty +
        WEIGHTS["delivery"] * delivery
    )

    topic_gated = topic < TOPIC_GATE_THRESHOLD
    stance_gated = stance < STANCE_GATE_THRESHOLD

    if not topic_gated and not stance_gated:
        return round(norm(weighted), 2), False, False

    caps = []
    if topic_gated:
        caps.append(OFF_TOPIC_FINAL_SCORE_CAP)
    if stance_gated:
        caps.append(OFF_STANCE_FINAL_SCORE_CAP)

    cap = min(caps)
    final_score = min(weighted, cap)
    return round(norm(final_score), 2), topic_gated, stance_gated

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
