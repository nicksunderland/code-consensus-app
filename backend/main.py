from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# --- THIS IS THE IMPORTANT PART ---
# This list defines which "origins" (websites)
# are allowed to make requests to your API.
origins = [
    "http://localhost:5173",  # Your local Vue app
    # We will add your Netlify URL here later
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------


@app.get("/api/hello")
def read_root():
    return {"message": "Hello from the FastAPI Backend!"}
