import os
from typing import TypedDict

from langgraph.graph import StateGraph, START, END
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain_core.prompts import ChatPromptTemplate
from langchain_classic.output_parsers import ResponseSchema, StructuredOutputParser


# -------------------------
# ENV
# -------------------------
os.environ["HUGGINGFACEHUB_API_TOKEN"] = os.getenv("HUGGINGFACEHUB_API_TOKEN", "")


# -------------------------
# STRUCTURED OUTPUT SETUP
# -------------------------
schema = [
    ResponseSchema(
        name="result",
        description="Final numerical result after evaluating the mathematical expression"
    )
]

parser = StructuredOutputParser.from_response_schemas(schema)
format_instructions = parser.get_format_instructions()


# -------------------------
# STATE
# -------------------------
class MathState(TypedDict):
    a: int
    b: int
    c: int
    d: int
    result: int


# -------------------------
# LLM
# -------------------------
base_llm = HuggingFaceEndpoint(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    temperature=0,
    max_new_tokens=200
)

llm = ChatHuggingFace(llm=base_llm)


# -------------------------
# PROMPT
# -------------------------
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a strict math engine. Return ONLY valid JSON."),
    ("human", """
Compute:

(a + b) * (c + d)

a = {a}
b = {b}
c = {c}
d = {d}

{format_instructions}
""")
])


# -------------------------
# AGENTS
# -------------------------

def set_a(state: MathState):
    return {"a": 2}

def set_b(state: MathState):
    return {"b": 3}

def set_c(state: MathState):
    return {"c": 4}

def set_d(state: MathState):
    return {"d": state["a"] + state["b"] + state["c"]}


def final_calculation(state: MathState):
    chain = prompt | llm

    response = chain.invoke({
        "a": state["a"],
        "b": state["b"],
        "c": state["c"],
        "d": state["d"],
        "format_instructions": format_instructions
    })

    parsed = parser.parse(response.content)

    return {"result": int(parsed["result"])}


# -------------------------
# GRAPH
# -------------------------
graph = StateGraph(MathState)

graph.add_node("set_a", set_a)
graph.add_node("set_b", set_b)
graph.add_node("set_c", set_c)
graph.add_node("set_d", set_d)
graph.add_node("final", final_calculation)

# Parallel
graph.add_edge(START, "set_a")
graph.add_edge(START, "set_b")
graph.add_edge(START, "set_c")

# Join
graph.add_edge("set_a", "set_d")
graph.add_edge("set_b", "set_d")
graph.add_edge("set_c", "set_d")

graph.add_edge("set_d", "final")
graph.add_edge("final", END)

workflow = graph.compile()


# -------------------------
# RUN
# -------------------------
if __name__ == "__main__":
    result = workflow.invoke({})
    print(result)