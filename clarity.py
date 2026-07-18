import os
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Set Hugging Face API Token
os.environ["HUGGINGFACEHUB_API_TOKEN"] = os.getenv("HUGGINGFACEHUB_API_TOKEN", "")

# LLM setup
llm = HuggingFaceEndpoint(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    temperature=0.3,
    max_new_tokens=200
)
chat_model = ChatHuggingFace(llm=llm)

clarity_prompt = ChatPromptTemplate.from_messages([
    
   ("system", 
"""You are an expert debate evaluator.

Evaluate ONLY the CLARITY of a spoken argument.

Definition:
Clarity = how easily a listener understands the meaning.

STRICT RULES:
- This is a verbal debate, not a writing task.
- Ignore grammar, sentence structure, conciseness, and formatting.
- Do NOT suggest improvements related to writing quality.
- Do NOT suggest making the response shorter or more structured.
- If the meaning is clear, give a high score even if the sentence is messy or long.

ONLY judge:
- Is the meaning understandable?
- Can a listener clearly grasp the point?

Scoring:
- 9–10: Meaning is completely clear, no confusion
- 7–8: Mostly clear, small confusion
- 5–6: Somewhat unclear
- 3–4: Hard to understand
- 0–2: Not understandable

IMPORTANT:
- If meaning is clear → issues = []
- If meaning is clear → suggestions = []

Return STRICT JSON:
{{
  "score": <0-10>,
  "justification": "<short reason>",
  "issues": [],
  "suggestions": []
}}
"""),

    MessagesPlaceholder(variable_name="history"),

    ("human", 
     """Debate Topic:
{question}

Participant Argument:
{response}

Context:
{context}

Evaluate ONLY clarity of the argument.""")
])

# Chain
eval_chain = clarity_prompt | chat_model


# 🔥 HARD-CODED INPUT (change here anytime)
question = " AI is good"
response = "ai is arti indira"
context = "None"

# Run once
result = eval_chain.invoke({
    "history": [],
    "question": question,
    "response": response,
    "context": context
})

print("📊 Clarity Evaluation Result:")
print(result.content.strip())