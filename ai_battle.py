import json
import sys
from ai_evaluator.models.model_loader import llm
from ai_evaluator.services.evaluator import evaluate_node

def extract_text_content(content) -> str:
    """Safely extracts text string from LangChain content which may be a string or a list."""
    if isinstance(content, list):
        return "".join(part.get("text", "") if isinstance(part, dict) else str(part) for part in content).strip()
    return str(content).strip()


def read_multiline_argument(prompt_label: str) -> str:
    """Reads a full (possibly multi-line/pasted) argument safely."""
    print(f"\n{prompt_label} (paste your argument, then press Enter on an empty line to submit):")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == "" and lines:
            break
        if line.strip() == "" and not lines:
            break
        lines.append(line)
    return "\n".join(lines).strip()

def play_ai_battle():
    print("=" * 60)
    print("🤖 USER VS AI DEBATE ARENA")
    print("=" * 60)

    # 1. Inputs
    topic = input("Enter debate topic: ").strip()
    while not topic:
        topic = input("Topic cannot be empty. Enter debate topic: ").strip()

    while True:
        user_stance = input("Pick your stance (FOR / AGAINST): ").strip().upper()
        if user_stance in ("FOR", "AGAINST"):
            break
        print("Please enter 'FOR' or 'AGAINST'.")

    ai_stance = "AGAINST" if user_stance == "FOR" else "FOR"
    print(f"\nYou are arguing {user_stance}. AI will argue {ai_stance}.\n")

    user_argument = read_multiline_argument("Your Argument")
    while not user_argument:
        user_argument = read_multiline_argument("Argument cannot be empty. Your Argument")

    while True:
        mode = input("Enter difficulty mode (easy | medium | hard): ").strip().lower()
        if mode in ("easy", "medium", "hard"):
            break
        print("Please enter 'easy', 'medium', or 'hard'.")

    print("\n[AI] Thinking and generating argument...")

    # 2. Generate AI Argument
    # NOTE: The old prompt only *described* the difficulty tiers in the abstract.
    # LLMs default to writing their "best" answer regardless of instructions like
    # "keep it simple", which is why easy mode was still scoring 80-90.
    # This version gives concrete constraints (length, forbidden techniques,
    # required flaws/omissions) AND an explicit target score band, so the
    # generated argument is actually weak/mediocre/strong in a way the
    # downstream judges will pick up on.
    difficulty_specs = {
        "easy": {
            "target_band": "20-45 out of 100",
            "instructions": (
                "* Write like an average person with only a surface-level opinion — NOT a debate expert.\n"
                "* Maximum 2-3 short sentences total.\n"
                "* Use ONLY generic, vague claims (e.g. \"it's just better\", \"everyone knows that\").\n"
                "* Do NOT cite any facts, statistics, studies, or real-world examples.\n"
                "* Do NOT rebut or even acknowledge the user's argument.\n"
                "* Do NOT use structured reasoning, logical connectors (\"therefore\", \"because\"), or multi-step logic.\n"
                "* It is okay — even expected — for the argument to contain a mild logical gap or unsupported leap.\n"
                "* No counter-attacks, no anticipation of rebuttals, no persuasive techniques."
            ),
        },
        "medium": {
            "target_band": "50-70 out of 100",
            "instructions": (
                "* Write like a moderately informed person, not an expert.\n"
                "* 3-5 sentences.\n"
                "* Include exactly ONE piece of reasoning or example, but keep it generic rather than deeply researched.\n"
                "* You may loosely acknowledge the user's argument, but do not construct a real rebuttal to it.\n"
                "* Some structure is fine, but avoid airtight logic or layered reasoning.\n"
                "* Do not include a counter-attack line or anticipate future objections.\n"
                "* This should be a solidly average argument: better than easy mode, clearly beatable, and missing depth a strong debater would include."
            ),
        },
        "hard": {
            "target_band": "85-100 out of 100",
            "instructions": (
                "* Write like an expert debater with subject-matter knowledge.\n"
                "* 5-8 sentences, tightly structured (claim -> evidence -> reasoning -> rebuttal -> counter-attack).\n"
                "* Include at least one concrete, verifiable-sounding fact, statistic, or real-world example.\n"
                "* Directly rebut the specific weak point(s) in the user's argument by name, not generically.\n"
                "* Anticipate the user's most likely comeback and pre-empt it.\n"
                "* End with one explicit counter-attack line that goes on the offensive against the user's stance.\n"
                "* No vague filler — every sentence must add logic, evidence, or rebuttal value."
            ),
        },
    }
    spec = difficulty_specs[mode]

    generator_prompt = (
        "🧠 AI ARGUMENT GENERATOR\n\n"
        "You are an intelligent debate agent participating in a structured \"User vs AI\" argument system. "
        "Your output will be scored by independent judges on clarity, logic, relevance, persuasiveness, and depth. "
        "You must calibrate the QUALITY of your argument to match the selected difficulty mode below — "
        "this is not just a style preference, it is a hard constraint on how strong the argument is allowed to be.\n\n"
        "⸻\n\n"
        f"🎯 SELECTED MODE: {mode.upper()}\n"
        f"Target overall score for this argument when judged: {spec['target_band']}.\n\n"
        f"REQUIRED BEHAVIOR FOR {mode.upper()} MODE:\n"
        f"{spec['instructions']}\n\n"
        "⸻\n\n"
        "📌 GENERAL RULES (apply to every mode):\n"
        "* Stay strictly on topic.\n"
        "* Be persuasive within the limits of the mode above, but never offensive or personal.\n"
        "* Do not repeat the user's argument verbatim.\n"
        f"* Defend the assigned stance: {ai_stance}\n"
        "* Do not exceed the sentence/length limit given for this mode, even if you think a longer answer would be better — "
        "matching the target difficulty is more important than writing your strongest possible argument.\n"
        "* Output ONLY the final argument text (no explanations, no meta commentary, no mention of difficulty mode).\n\n"
        "⸻\n\n"
        "📥 INPUT\n"
        f"Topic: {topic}\n"
        f"User Argument: {user_argument}\n"
        f"Mode: {mode}\n\n"
        "⸻\n\n"
        "📤 OUTPUT FORMAT:\n"
        "AI Argument:"
    )

    try:
        res = llm.invoke(generator_prompt)
        ai_argument = extract_text_content(res.content)
        # Clean any leading metadata labels
        if ai_argument.lower().startswith("ai argument:"):
            ai_argument = ai_argument[len("ai argument:"):].strip()
    except Exception as e:
        print(f"Error generating AI argument: {e}")
        sys.exit(1)

    print("\n" + "="*30 + " AI ARGUMENT " + "="*30)
    print(ai_argument)
    print("="*73)

    print("\n[Evaluator] Running multi-judge scoring on both arguments...")

    # 3. Evaluate User Argument
    user_state = {
        "topic": topic,
        "user1_args": [],
        "user2_args": [],
        "user1_stance": user_stance,
        "user2_stance": ai_stance,
        "current_round": 1,
        "current_user": "user1",
        "current_argument": user_argument,
        "user1_total": 0.0,
        "user2_total": 0.0,
        "is_ai": False,
        "difficulty": mode,
    }
    user_eval = evaluate_node(user_state)

    # 4. Evaluate AI Argument
    ai_state = {
        "topic": topic,
        "user1_args": [user_argument],
        "user2_args": [],
        "user1_stance": user_stance,
        "user2_stance": ai_stance,
        "current_round": 1,
        "current_user": "user2",
        "current_argument": ai_argument,
        "user1_total": 0.0,
        "user2_total": 0.0,
        "is_ai": True,
        "difficulty": mode,
    }
    ai_eval = evaluate_node(ai_state)

    # Normalize 0-100 down to 0-10
    user_score_dict = {
        "clarity": round(user_eval.get("delivery_score", 100.0) / 10.0, 1),
        "logic": round(user_eval.get("fact_score", 0.0) / 10.0, 1),
        "relevance": round(user_eval.get("topic_score", 0.0) / 10.0, 1),
        "persuasiveness": round(user_eval.get("related_score", 0.0) / 10.0, 1),
        "depth": round(user_eval.get("novelty_score", 0.0) / 10.0, 1),
        "total": round(user_eval.get("final_score", 0.0) / 10.0, 1)
    }

    ai_score_dict = {
        "clarity": round(ai_eval.get("delivery_score", 100.0) / 10.0, 1),
        "logic": round(ai_eval.get("fact_score", 0.0) / 10.0, 1),
        "relevance": round(ai_eval.get("topic_score", 0.0) / 10.0, 1),
        "persuasiveness": round(ai_eval.get("related_score", 0.0) / 10.0, 1),
        "depth": round(ai_eval.get("novelty_score", 0.0) / 10.0, 1),
        "total": round(ai_eval.get("final_score", 0.0) / 10.0, 1)
    }

    # Decide winner
    if user_score_dict["total"] > ai_score_dict["total"]:
        winner = "User"
    elif ai_score_dict["total"] > user_score_dict["total"]:
        winner = "AI"
    else:
        # Tie breaker: logic score
        if user_score_dict["logic"] >= ai_score_dict["logic"]:
            winner = "User"
        else:
            winner = "AI"

    # Summarize explanation using Gemini
    summary_prompt = (
        "You are an objective debate evaluator. Write a concise, 1-2 sentence explanation of why the winner won "
        "based on their scores and judges' comments.\n\n"
        f"Winner: {winner}\n"
        f"User Scores: {user_score_dict}\n"
        f"User Judge Reasoning: {user_eval.get('reasoning', [])}\n"
        f"AI Scores: {ai_score_dict}\n"
        f"AI Judge Reasoning: {ai_eval.get('reasoning', [])}\n\n"
        "Output ONLY the final 1-2 sentence explanation."
    )

    try:
        summary_res = llm.invoke(summary_prompt)
        reason_text = extract_text_content(summary_res.content)
    except Exception:
        reason_text = f"Winner chosen based on final score total of {max(user_score_dict['total'], ai_score_dict['total'])} vs {min(user_score_dict['total'], ai_score_dict['total'])}."

    output_json = {
        "user_score": user_score_dict,
        "ai_score": ai_score_dict,
        "winner": winner,
        "reason": reason_text
    }

    print("\n" + "="*30 + " EVALUATION " + "="*30)
    print(json.dumps(output_json, indent=2, ensure_ascii=False))
    print("="*72)

if __name__ == "__main__":
    play_ai_battle()