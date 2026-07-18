# pip install langgraph langchain langchain_huggingface pydantic

import os
import json
import re
from typing import TypedDict, List, Dict

from langgraph.graph import StateGraph, END

from langchain_huggingface import HuggingFaceEndpoint
from langchain_core.prompts import ChatPromptTemplate


# =========================
# HF SETUP
# =========================

os.environ["HUGGINGFACEHUB_API_TOKEN"] = "YOUR_HF_TOKEN"

llm = HuggingFaceEndpoint(
    repo_id="Qwen/Qwen2.5-7B-Instruct",
    temperature=0.3,
    max_new_tokens=200
)


# =========================
# STATE
# =========================

class DebateState(TypedDict):
    topic: str
    rounds: int
    current_round: int
    speaker: str
    argument: str

    history: List[Dict]
    scores: Dict[str, List[Dict]]


# =========================
# STRICT JUDGE PROMPT
# =========================

judge_prompt = """
You are a STRICT debate scoring engine.

You MUST return ONLY valid JSON.

Schema:
{
  "relevance": 0-10,
  "clarity": 0-10,
  "logic": 0-10,
  "depth": 0-10,
  "evidence": 0-10,
  "persuasion": 0-10
}

Rules:
- integers only
- values must be between 0 and 10
- no explanation
- no text outside JSON

Argument:
{argument}
"""


# =========================
# SAFE JSON PARSER
# =========================

def extract_json(text: str):
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None

        data = json.loads(match.group())

        # fix common model mistakes
        if "clearness" in data:
            data["clarity"] = data.pop("clearness")

        # clamp values
        for k, v in data.items():
            if isinstance(v, (int, float)):
                data[k] = max(0, min(10, int(v)))

        return data

    except:
        return None


# =========================
# NODE 1: INIT
# =========================

def init_node(state: DebateState):
    state["current_round"] = 1
    state["speaker"] = "P1"
    state["history"] = []
    state["scores"] = {"P1": [], "P2": []}
    return state


# =========================
# NODE 2: JUDGE
# =========================

def judge_node(state: DebateState):

    prompt = judge_prompt.format(argument=state["argument"])

    raw = llm(prompt)[0]["generated_text"]

    score = extract_json(raw)

    if score is None:
        score = {
            "relevance": 0,
            "clarity": 0,
            "logic": 0,
            "depth": 0,
            "evidence": 0,
            "persuasion": 0
        }

    state["scores"][state["speaker"]].append(score)

    state["history"].append({
        "speaker": state["speaker"],
        "round": state["current_round"],
        "argument": state["argument"],
        "score": score
    })

    print("\n🎯", state["speaker"], ":", state["argument"])
    print("📊 SCORE:", score)

    return state


# =========================
# NODE 3: SWITCH TURN
# =========================

def switch_node(state: DebateState):

    if state["speaker"] == "P1":
        state["speaker"] = "P2"
    else:
        state["speaker"] = "P1"
        state["current_round"] += 1

    return state


# =========================
# ROUTER
# =========================

def route(state: DebateState):
    if state["current_round"] > state["rounds"]:
        return "end"
    return "continue"


# =========================
# FINAL NODE
# =========================

def final_node(state: DebateState):

    def avg(player):
        arr = state["scores"][player]
        if not arr:
            return 0

        total = 0
        count = 0

        for s in arr:
            total += sum(s.values())
            count += len(s)

        return round(total / count, 2)

    p1 = avg("P1")
    p2 = avg("P2")

    print("\n🏁 FINAL RESULT")
    print("----------------")
    print("Player 1:", p1)
    print("Player 2:", p2)

    if p1 > p2:
        print("\n🏆 WINNER: PLAYER 1")
    elif p2 > p1:
        print("\n🏆 WINNER: PLAYER 2")
    else:
        print("\n🤝 DRAW")

    return state


# =========================
# GRAPH BUILD
# =========================

builder = StateGraph(DebateState)

builder.add_node("init", init_node)
builder.add_node("judge", judge_node)
builder.add_node("switch", switch_node)
builder.add_node("final", final_node)

builder.set_entry_point("init")

builder.add_edge("init", "judge")
builder.add_edge("judge", "switch")

builder.add_conditional_edges(
    "switch",
    route,
    {
        "continue": "judge",
        "end": "final"
    }
)

builder.add_edge("final", END)

graph = builder.compile()


# =========================
# RUN GAME
# =========================

state = {
    "topic": "AI is dangerous",
    "rounds": 3,
    "current_round": 0,
    "speaker": "P1",
    "argument": ""
}

print("\n🎮 DEBATE GAME START\n")

print("\n🎮 DEBATE START\n")

for i in range(state["rounds"] * 2):

    # 👇 THIS is where user input happens
    state["argument"] = input(f"\n🎤 {state['speaker']} enter argument: ")

    # 👇 Graph only evaluates + switches
    state = graph.invoke(state)