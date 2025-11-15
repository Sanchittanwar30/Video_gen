"""
FastAPI Server for Colab Video Rendering API

This is a Python/FastAPI version of the Colab API server.
Use this if you prefer Python over Node.js.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
import asyncio
import subprocess

app = FastAPI(title="Colab Video Rendering API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Job storage (in production, use a database)
JOBS_DIR = Path("temp/colab-jobs")
JOBS_DIR.mkdir(parents=True, exist_ok=True)
JOBS_FILE = JOBS_DIR / "jobs.json"

# Load/save jobs
def load_jobs() -> Dict[str, Dict]:
    if JOBS_FILE.exists():
        with open(JOBS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_jobs(jobs: Dict[str, Dict]):
    with open(JOBS_FILE, 'w') as f:
        json.dump(jobs, f, indent=2, default=str)

# Pydantic models
class VideoFrame(BaseModel):
    id: str
    type: str
    duration: int
    text: Optional[str] = None
    animate: Optional[bool] = False
    vectorized: Optional[Dict[str, Any]] = None
    voiceoverUrl: Optional[str] = None

class VideoPlan(BaseModel):
    frames: List[VideoFrame]

class CreateJobRequest(BaseModel):
    videoPlan: VideoPlan
    callbackUrl: Optional[str] = None

class JobStatus(BaseModel):
    jobId: str
    status: str
    createdAt: str
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    error: Optional[str] = None
    downloadUrl: Optional[str] = None

class CallbackRequest(BaseModel):
    status: str
    outputPath: Optional[str] = None
    error: Optional[str] = None
    startedAt: Optional[bool] = None

# Health check
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "colab-video-api-fastapi"
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Colab Video Rendering API (FastAPI)",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "createJob": "POST /api/colab/generate",
            "jobStatus": "GET /api/colab/status/{jobId}",
            "download": "GET /api/colab/download/{jobId}",
            "pendingJobs": "GET /api/colab/jobs/pending",
            "callback": "POST /api/colab/callback/{jobId}",
            "process": "POST /api/colab/process/{jobId}"
        }
    }

# Create Colab job
@app.post("/api/colab/generate", status_code=202)
async def create_job(request: CreateJobRequest):
    """Create a new video rendering job for Colab processing."""
    job_id = f"colab-{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:6]}"
    
    job = {
        "jobId": job_id,
        "status": "pending",
        "videoPlan": request.videoPlan.dict(),
        "createdAt": datetime.now().isoformat(),
        "callbackUrl": request.callbackUrl
    }
    
    # Save job
    jobs = load_jobs()
    jobs[job_id] = job
    save_jobs(jobs)
    
    # Save video plan JSON
    plan_path = JOBS_DIR / f"{job_id}-plan.json"
    with open(plan_path, 'w') as f:
        json.dump(request.videoPlan.dict(), f, indent=2)
    
    # Create status file
    status_path = JOBS_DIR / f"{job_id}-status.json"
    with open(status_path, 'w') as f:
        json.dump({"status": "pending"}, f)
    
    return {
        "jobId": job_id,
        "status": "pending",
        "createdAt": job["createdAt"],
        "endpoints": {
            "status": f"/api/colab/status/{job_id}",
            "download": f"/api/colab/download/{job_id}",
            "plan": f"/api/colab/plan/{job_id}"
        },
        "message": "Job created. Use Colab notebook to process, or poll status endpoint."
    }

# Get job status
@app.get("/api/colab/status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a Colab job."""
    jobs = load_jobs()
    job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    download_url = None
    if job["status"] == "completed":
        download_url = f"/api/colab/download/{job_id}"
    
    return {
        "jobId": job_id,
        "status": job["status"],
        "createdAt": job["createdAt"],
        "startedAt": job.get("startedAt"),
        "completedAt": job.get("completedAt"),
        "error": job.get("error"),
        "downloadUrl": download_url
    }

# Get job plan
@app.get("/api/colab/plan/{job_id}")
async def get_job_plan(job_id: str):
    """Get the video plan JSON for a job."""
    plan_path = JOBS_DIR / f"{job_id}-plan.json"
    
    if not plan_path.exists():
        raise HTTPException(status_code=404, detail="Job plan not found")
    
    with open(plan_path, 'r') as f:
        return json.load(f)

# Get pending jobs
@app.get("/api/colab/jobs/pending")
async def get_pending_jobs():
    """Get all pending jobs (for Colab to poll)."""
    jobs = load_jobs()
    pending = [
        {
            "jobId": job_id,
            "createdAt": job["createdAt"],
            "planUrl": f"/api/colab/plan/{job_id}",
            "callbackUrl": job.get("callbackUrl")
        }
        for job_id, job in jobs.items()
        if job["status"] == "pending"
    ]
    
    return {"jobs": pending}

# Job callback
@app.post("/api/colab/callback/{job_id}")
async def job_callback(job_id: str, request: CallbackRequest):
    """Callback endpoint for Colab to report job completion."""
    jobs = load_jobs()
    job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update job
    job["status"] = request.status
    
    if request.status == "processing" and request.startedAt:
        job["startedAt"] = datetime.now().isoformat()
    
    if request.status == "completed":
        job["completedAt"] = datetime.now().isoformat()
        if request.outputPath:
            job["outputPath"] = request.outputPath
    
    if request.status == "failed":
        job["completedAt"] = datetime.now().isoformat()
        if request.error:
            job["error"] = request.error
    
    jobs[job_id] = job
    save_jobs(jobs)
    
    # Update status file
    status_path = JOBS_DIR / f"{job_id}-status.json"
    with open(status_path, 'w') as f:
        json.dump({
            "status": job["status"],
            "outputPath": job.get("outputPath"),
            "error": job.get("error")
        }, f)
    
    # Call webhook if provided
    if job.get("callbackUrl") and request.status in ["completed", "failed"]:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(job["callbackUrl"], json={
                    "jobId": job_id,
                    "status": job["status"],
                    "outputPath": job.get("outputPath"),
                    "error": job.get("error")
                })
        except Exception as e:
            print(f"Failed to call webhook: {e}")
    
    return {"success": True, "job": {"jobId": job_id, "status": job["status"]}}

# Download video
@app.get("/api/colab/download/{job_id}")
async def download_video(job_id: str):
    """Download the rendered video for a completed job."""
    jobs = load_jobs()
    job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not completed. Current status: {job['status']}"
        )
    
    output_path = job.get("outputPath") or JOBS_DIR / f"{job_id}-output.mp4"
    output_path = Path(output_path)
    
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"video-{job_id}.mp4"
    )

# Process job locally (fallback)
@app.post("/api/colab/process/{job_id}")
async def process_job_locally(job_id: str):
    """Process a job locally (fallback if Colab is not available)."""
    jobs = load_jobs()
    job = jobs.get(job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Job is not pending. Current status: {job['status']}"
        )
    
    # Update status to processing
    job["status"] = "processing"
    job["startedAt"] = datetime.now().isoformat()
    jobs[job_id] = job
    save_jobs(jobs)
    
    # Process in background (this would call your Node.js renderer)
    # For now, just return - you'd need to integrate with your renderer
    asyncio.create_task(process_video_background(job_id, job["videoPlan"]))
    
    return {
        "success": True,
        "message": "Job processing started",
        "jobId": job_id
    }

async def process_video_background(job_id: str, video_plan: Dict):
    """Background task to process video (integrate with your renderer)."""
    try:
        # This would call your Node.js renderer or Python renderer
        # For now, we'll just mark it as a placeholder
        # You'd need to integrate with your actual rendering pipeline
        
        # Example: Call Node.js renderer via subprocess
        # result = subprocess.run(
        #     ["node", "render-video.js", json.dumps(video_plan)],
        #     capture_output=True
        # )
        
        # For now, just simulate
        await asyncio.sleep(1)
        
        jobs = load_jobs()
        job = jobs.get(job_id)
        if job:
            job["status"] = "failed"
            job["error"] = "Local processing not yet implemented. Use Colab or Node.js server."
            job["completedAt"] = datetime.now().isoformat()
            jobs[job_id] = job
            save_jobs(jobs)
    except Exception as e:
        jobs = load_jobs()
        job = jobs.get(job_id)
        if job:
            job["status"] = "failed"
            job["error"] = str(e)
            job["completedAt"] = datetime.now().isoformat()
            jobs[job_id] = job
            save_jobs(jobs)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)

