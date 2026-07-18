import os
import sys
import json
import time

# Add current directory to path so we can import td
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_evaluator import evaluate_node, DebateState

scenarios = [
    {
        "name": "Subtle Thematic Divergence (Ned Stark / family themes in GoT)",
        "topic": "game of throne",
        "current_argument": "While many view Game of Thrones as a story of political schemes, it is fundamentally a tragedy about family bonds. The core narrative is driven by Ned Stark's devotion to his children and how that legacy of family loyalty ultimately shapes the survival of House Stark, proving that familial love, not the Iron Throne, is the heart of the series.",
        "user1_args": [],
        "user2_args": [],
        "current_user": "user1",
        "current_round": 1,
        "user1_total": 0.0,
        "user2_total": 0.0
    },
    {
        "name": "True Off-Topic (Suits legal drama)",
        "topic": "game of throne",
        "current_argument": "Suits is a legal drama about corporate lawyers in New York. The story follows Mike Ross, who has a photographic memory and lands a job at a prestigious law firm working under Harvey Specter, despite never going to law school. Together they win cases using high-stakes bluffs and legal loopholes.",
        "user1_args": ["GoT is about political power."],
        "user2_args": [],
        "current_user": "user2",
        "current_round": 1,
        "user1_total": 0.0,
        "user2_total": 0.0
    },
    {
        "name": "Gibberish / Spam Input",
        "topic": "artificial intelligence",
        "current_argument": "fdfsdffs",
        "user1_args": [],
        "user2_args": [],
        "current_user": "user1",
        "current_round": 1,
        "user1_total": 0.0,
        "user2_total": 0.0
    },
    {
        "name": "Superficial, Assertion-Only Argument (AI threat)",
        "topic": "artificial intelligence",
        "current_argument": "I think AI is a major threat to humanity because it will take away all of our jobs and then people will not have money, which will cause society to collapse completely and make everyone unhappy.",
        "user1_args": [],
        "user2_args": [],
        "current_user": "user1",
        "current_round": 1,
        "user1_total": 0.0,
        "user2_total": 0.0
    },
    {
        "name": "High-Quality Evidenced Argument (AI threat)",
        "topic": "artificial intelligence",
        "current_argument": "Artificial intelligence poses an existential threat primarily through the centralization of power and the misalignment of autonomous systems. According to a 2023 survey by AI impacts, 36% of AI researchers believe there is a non-trivial risk of human extinction from AI. When systems are optimized for narrow objectives without robust safety bounds, they exhibit instrumentally rational behaviors—such as resource acquisition and self-preservation—that directly conflict with human survival, as detailed in Nick Bostrom's Superintelligence.",
        "user1_args": [],
        "user2_args": [],
        "current_user": "user1",
        "current_round": 1,
        "user1_total": 0.0,
        "user2_total": 0.0
    }
]

def run_tests():
    print("=" * 60)
    print("STARTING QA EVALUATION SCENARIO TESTS")
    print("=" * 60)
    
    for i, sc in enumerate(scenarios, 1):
        print(f"\n--- SCENARIO {i}: {sc['name']} ---")
        print(f"Topic:            {sc['topic']}")
        print(f"Current Argument: {sc['current_argument']}")
        
        # Cast dict to DebateState representation
        state = {
            "topic": sc["topic"],
            "user1_args": sc["user1_args"],
            "user2_args": sc["user2_args"],
            "current_round": sc["current_round"],
            "current_user": sc["current_user"],
            "current_argument": sc["current_argument"],
            "user1_total": sc["user1_total"],
            "user2_total": sc["user2_total"],
            "retrieved_facts": ""
        }
        
        try:
            result = evaluate_node(state)
            
            print("\nResult Scores:")
            print(f"  Topic Score:   {result.get('topic_score')} (gated: {result.get('gated')})")
            print(f"  Related Score: {result.get('related_score')}")
            print(f"  Fact Score:    {result.get('fact_score')}")
            print(f"  Novelty Score: {result.get('novelty_score')}")
            print(f"  Final Score:   {result.get('final_score')}")
            
            print("\nJudges' Reasonings:")
            for reason in result.get("reasoning", []):
                print(f"  {reason}")
                
        except Exception as e:
            print(f"  Error invoking evaluate_node: {e}")
            
        print("-" * 60)
        # Sleep to avoid hitting Hugging Face Serverless rate/token limits
        time.sleep(12)

if __name__ == "__main__":
    run_tests()
