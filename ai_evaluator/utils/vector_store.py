import numpy as np
from typing import List
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from ai_evaluator import config  # Ensures environment variables are set

_embedding_model = None
_topic_stores = {}

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

def fetch_query_facts(query: str, max_results: int = 5) -> str:
    """
    Queries DuckDuckGo search for a specific target query and combines top result
    snippets for dynamic live web verification.
    """
    try:
        from ddgs import DDGS
        import time
        print(f"[RAG] Querying DuckDuckGo live search for: '{query}'...")
        
        results = []
        for backend in ["auto", "html", "lite"]:
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, backend=backend, max_results=max_results))
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
        print(f"[RAG] Successfully fetched {word_count} words of live search context.")
        return combined_text
    except Exception as e:
        print(f"[RAG] Error querying DuckDuckGo live search: {e}")
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


def get_topic_store(topic: str) -> TopicVectorStore:
    global _topic_stores
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
