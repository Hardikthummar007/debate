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

# ✅ FIXED Relevance prompt (escaped JSON)
relevance_prompt = ChatPromptTemplate.from_messages([
    
    ("system", 
     """You are an expert evaluator.

Evaluate the RELEVANCE of a response to a question.

Definition:
Relevance = how directly the response answers the question.

Criteria:
- Stays on topic
- No unnecessary info
- Covers key parts of question

Strict scoring:
- 9–10: fully relevant
- 7–8: mostly relevant
- 5–6: partially relevant
- 3–4: weak
- 0–2: irrelevant

Return STRICT JSON:
{{
  "score": <0-10>,
  "justification": "<short reason>",
  "issues": ["..."],
  "suggestions": ["..."]
}}
"""),

    MessagesPlaceholder(variable_name="history"),

    ("human", 
     """Question:
{question}

Response:
{response}

Context:
{context}

Evaluate relevance.""")
])

# Chain
eval_chain = relevance_prompt | chat_model

if __name__ == "__main__":
    print("🎯 Relevance Evaluator Ready! Type 'exit' to quit.")
    print("--------------------------------------------------")
    
    while True:
        question = input("\n🟢 Enter Question: ")
        if question.lower() in ["exit", "quit"]:
            break
        
        response = input("🔵 Enter Response: ")
        
        try:
            result = eval_chain.invoke({
                "history": [],
                "question": question,
                "response": response,
                "context": "None"
            })
            
            print("\n📊 Evaluation Result:")
            print(result.content.strip())
            print("-" * 50)
        
        except Exception as e:
            print(f"Error: {e}")