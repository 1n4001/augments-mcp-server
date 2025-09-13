#!/usr/bin/env python3
"""
Minimal FastAPI server for Railway deployment testing
"""
import os
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Minimal Test Server")

@app.get("/")
def root():
    return {"message": "Minimal server is running", "port": os.getenv("PORT", "8080")}

@app.get("/health")
def health():
    return {"status": "healthy", "env_vars": {
        "PORT": os.getenv("PORT"),
        "ENV": os.getenv("ENV"),
        "REDIS_URL": "***" if os.getenv("REDIS_URL") else None,
        "GITHUB_TOKEN": "***" if os.getenv("GITHUB_TOKEN") else None,
    }}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    print(f"Starting minimal server on port {port}")
    uvicorn.run(
        "minimal_server:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )