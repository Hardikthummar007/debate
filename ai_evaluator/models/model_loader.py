from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from ai_evaluator import config  # Ensures environment variables are loaded first

# --- PYDANTIC SCHEMAS FOR STRUCTURED OUTPUT ---

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

class Judge5Output(BaseModel):
    reasoning: str = Field(description="Concise justification (max 2 sentences) for delivery/fluency score.")
    delivery_score: float = Field(description="Score 0-100 for pacing, fluency, restarts, and pauses.")

class RouterOutput(BaseModel):
    strategy: str = Field(description="Must be exactly 'internal', 'rag', or 'web'. Choice of knowledge search.")
    reason: str = Field(description="Brief reason (max 2 sentences) for this routing choice.")
    confidence: float = Field(description="Confidence score (0.0 to 1.0) of the decision.")
    search_query: str = Field(description="If strategy is 'web' or 'rag', generate a concise search query (3-6 words) to find facts to verify the argument's claims. Otherwise, leave empty.")

# --- LLM INITIALIZATION & BINDING ---

llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    temperature=0.2,
    max_output_tokens=2048,
    timeout=60
)

# Bind structured output to the model for each judge
judge3_llm = llm.with_structured_output(Judge3Output)
judge1_llm = llm.with_structured_output(Judge1Output)
judge2_llm = llm.with_structured_output(Judge2Output)
judge4_llm = llm.with_structured_output(Judge4Output)
judge5_llm = llm.with_structured_output(Judge5Output)
router_llm = llm.with_structured_output(RouterOutput)

