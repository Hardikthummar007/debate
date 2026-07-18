# pip install langgraph langchain langchain_huggingface

import os
import re
import json
import numpy as np
from typing import TypedDict, List, Dict, Any

from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace
from langchain_core.messages import SystemMessage, HumanMessage

# =========================
# HF MODEL (ONLY ONE)
# =========================

os.environ["HUGGINGFACEHUB_API_TOKEN"] = os.getenv("HUGGINGFACEHUB_API_TOKEN", "")

llm = HuggingFaceEndpoint(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    temperature=0.3,
    max_new_tokens=150
)

chat = ChatHuggingFace(llm=llm)

# =========================
# STATE
# =========================

class State(TypedDict):
    topic: str
    argument: str

    relevance: int
    clarity: int
    logic: int
    depth: int
    evidence: int
    persuasion: int

    final_score: float


# =========================
# MESSAGE FORMATTER
# =========================

def get_messages(metric: str, argument: str):
    return [
        SystemMessage(content=f"""You are a strict debate judge.

Evaluate ONLY: {metric}

Return ONLY valid JSON:
{{"score": 0-10}}

No explanation."""),
        HumanMessage(content=argument)
    ]


# =========================
# 1. PARALLEL AGENTS (6)
# =========================

# Nodes in parallel should only return their specific state updates
# to prevent concurrent write conflicts on shared keys like topic and argument.
def relevance_agent(state: State):
    messages = get_messages("relevance", state["argument"])
    res = chat.invoke(messages)
    return {"relevance": extract_score(res.content)}


def clarity_agent(state: State):
    messages = get_messages("clarity", state["argument"])
    res = chat.invoke(messages)
    return {"clarity": extract_score(res.content)}


def logic_agent(state: State):
    messages = get_messages("logic", state["argument"])
    res = chat.invoke(messages)
    return {"logic": extract_score(res.content)}


def depth_agent(state: State):
    messages = get_messages("depth", state["argument"])
    res = chat.invoke(messages)
    return {"depth": extract_score(res.content)}


def evidence_agent(state: State):
    messages = get_messages("evidence", state["argument"])
    res = chat.invoke(messages)
    return {"evidence": extract_score(res.content)}


def persuasion_agent(state: State):
    messages = get_messages("persuasion", state["argument"])
    res = chat.invoke(messages)
    return {"persuasion": extract_score(res.content)}


# =========================
# SAFE PARSER
# =========================

def extract_score(text: str) -> int:
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return 0
        data = json.loads(match.group())
        return max(0, min(10, int(data.get("score", 0))))
    except:
        return 0


# =========================
# 2. START NODE
# =========================

def start_node(state: State):
    # Pass-through node acting as a single entry point for the parallel fan-out
    return state


# =========================
# 3. FINAL AGGREGATOR NODE
# =========================

def aggregator(state: State):
    weights = {
        "relevance": 1.2,
        "clarity": 1.0,
        "logic": 1.5,
        "depth": 1.2,
        "evidence": 1.0,
        "persuasion": 1.1
    }

    total = 0
    weight_sum = 0

    for k, w in weights.items():
        total += state[k] * w
        weight_sum += w

    return {"final_score": round(total / weight_sum, 2)}


# =========================
# BUILD GRAPH (TRUE MULTI-AGENT FAN-OUT & FAN-IN)
# =========================

builder = StateGraph(State)

# Register nodes
builder.add_node("start", start_node)
builder.add_node("relevance", relevance_agent)
builder.add_node("clarity", clarity_agent)
builder.add_node("logic", logic_agent)
builder.add_node("depth", depth_agent)
builder.add_node("evidence", evidence_agent)
builder.add_node("persuasion", persuasion_agent)
builder.add_node("aggregate", aggregator)

# Set entry point
builder.set_entry_point("start")

# Fan-out: start node triggers all 6 evaluators in parallel (concurrently)
builder.add_edge("start", "relevance")
builder.add_edge("start", "clarity")
builder.add_edge("start", "logic")
builder.add_edge("start", "depth")
builder.add_edge("start", "evidence")
builder.add_edge("start", "persuasion")

# Fan-in: all parallel evaluators point to the aggregator
builder.add_edge("relevance", "aggregate")
builder.add_edge("clarity", "aggregate")
builder.add_edge("logic", "aggregate")
builder.add_edge("depth", "aggregate")
builder.add_edge("evidence", "aggregate")
builder.add_edge("persuasion", "aggregate")

builder.add_edge("aggregate", END)

app = builder.compile()


# SHOW GRAPH (Mermaid)
print(app.get_graph().draw_mermaid())


# =========================
# 🎮 RUN SYSTEM
# =========================



if __name__ == "__main__":
    print("\n🎮 MULTI-AGENT DEBATE ENGINE\n")

    topic = input("Enter topic: ")

    while True:
        arg = input("\nEnter argument (or 'exit'): ")
        if arg.lower() == "exit":
            break

        state = {
            "topic": topic,
            "argument": arg
        }

        result = app.invoke(state)

        print("\n📊 SCORES:")
        print("Relevance :", result["relevance"])
        print("Clarity   :", result["clarity"])
        print("Logic     :", result["logic"])
        print("Depth     :", result["depth"])
        print("Evidence  :", result["evidence"])
        print("Persuasion:", result["persuasion"])

        print("\n🏁 FINAL SCORE:", result["final_score"])