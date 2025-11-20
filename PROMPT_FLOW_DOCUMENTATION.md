# Storyboard Image Generation - Prompt Flow Documentation

## Overview
This document explains how prompts are generated, processed, and sent to the Gemini Imagen API for storyboard image generation.

## Complete Flow

### Step 1: Structured Plan Generation
**File**: `server/services/gemini-structured.ts`
**Function**: `generateStructuredJSON()`

- **Input**: Topic and description from user
- **Process**: 
  - Calls Gemini Text API with a structured prompt template
  - Generates a JSON plan with 1-5 frames
  - Each frame includes a `prompt_for_image` field
- **Output**: Structured plan with frames containing `prompt_for_image` strings

**Example `prompt_for_image` from structured plan:**
```
"A clear educational whiteboard diagram explaining polymorphism in C++ using geometric shapes, flowcharts, and visual connections. Show inheritance relationships and method overriding. Include essential labels (less than 10% text) that help explain the concept."
```

---

### Step 2: Prompt Sanitization (First Layer)
**File**: `server/services/gemini-structured.ts`
**Function**: `sanitizePromptForImage()`

**What it removes:**
- Code blocks (```json, ```mermaid, etc.)
- JSON structures (`{"visual_aid": ...}`)
- Arrays with metadata
- Forbidden words: `visual_aid`, `visual aid`, `mermaid`, `diagram`, `chart`, `figure`
- Mermaid syntax: `graph TD`, `-->`, `[]`, `()`, `{}`
- Metadata patterns: `Type:`, `Style:`, `Category:`
- Phrases containing forbidden terms

**Result**: Clean prompt without metadata or code syntax

---

### Step 3: Enhanced Prompt Creation
**File**: `server/routes/generateVideo.ts`
**Lines**: 136-397

**Process:**
1. **Second Sanitization** (Ultra-aggressive):
   - Removes ALL code blocks, JSON, arrays
   - Removes forbidden words with word boundaries
   - Removes Mermaid syntax completely
   - Final validation loop to catch any remaining forbidden terms

2. **Fallback Check**:
   - If sanitization removed too much (prompt < 10 chars), uses fallback:
   ```
   "A clear educational whiteboard diagram explaining [topic]. Use geometric shapes, flowcharts, and visual connections. Include essential labels with correct spelling."
   ```

3. **Enhanced Prompt Assembly**:
   - Combines sanitized prompt with extensive instructions
   - Adds voiceover context (if available)
   - Creates a comprehensive prompt with:
     - **Role definition**: "You are a teacher drawing on a WHITEBOARD"
     - **Forbidden items**: Extensive list of what NOT to include
     - **Content requirements**: What to draw (simple shapes, flowcharts, etc.)
     - **Text requirements**: Spelling accuracy, minimal text
     - **Style requirements**: White background, bold strokes, animation-friendly
     - **Background requirements**: Pure white only
     - **Diagram description**: The sanitized prompt from Step 2
     - **Voiceover context**: Supporting text labels (if voiceover exists)

**Final Enhanced Prompt Structure:**
```
You are a teacher drawing on a WHITEBOARD. This is a HAND-DRAWN DIAGRAM...

🚫 ABSOLUTELY FORBIDDEN - DO NOT WRITE THESE WORDS IN THE IMAGE:
- "visual_aid" or "visual aid" - NEVER write this
- "diagram", "chart", "figure" - NEVER write descriptive labels
- Mermaid syntax - NEVER write Mermaid code
...

CONTENT REQUIREMENTS:
- The diagram MUST be directly related to and explain ONLY the topic: "[topic]"
- Create a SIMPLE, educational diagram...
...

DIAGRAM DESCRIPTION:
[sanitizedImagePrompt from Step 2]

[voiceoverContext if available]
```

---

### Step 4: Final Sanitization (Third Layer)
**File**: `server/services/gemini.ts`
**Function**: `sanitizePromptForImagen()`

**Called in**: `callGeminiImage()` before sending to API

**What it removes:**
- Any remaining code blocks
- JSON structures
- Arrays
- Forbidden words: `visual_aid`, `mermaid`, `diagram`, `chart`, `figure`
- Mermaid syntax
- Metadata patterns

**This is the final defense** before the prompt reaches Imagen API.

---

### Step 5: API Call to Imagen
**File**: `server/services/gemini.ts`
**Function**: `callGeminiImage()`

**API Endpoint**: 
- Vertex AI: `/v1/projects/{PROJECT_ID}/locations/us-central1/publishers/google/models/{MODEL}:predict`
- Models tried (in order):
  1. `imagen-4.0-generate-preview-06-06` (default)
  2. `imagen-4.0-generate-001`
  3. `imagen-3.0-generate-001`
  4. `imagen-2.0-generate-001` (fallback)

**Request Payload**:
```json
{
  "instances": [
    {
      "prompt": "[FINAL SANITIZED PROMPT]"
    }
  ],
  "parameters": {
    "sampleCount": 1,
    "mimeType": "image/png",
    "aspectRatio": "16:9"
  }
}
```

**Response Handling**:
- Checks for RAI filtering (`raiFilteredReason`)
- Extracts base64 image data
- Saves to `/public/assets/gemini-images/`
- Returns image URL

---

## Key Features

### 1. Multi-Layer Sanitization
- **Layer 1**: In structured plan generation
- **Layer 2**: In video generation route (ultra-aggressive)
- **Layer 3**: In gemini.ts before API call

### 2. Forbidden Terms Removal
All layers remove:
- `visual_aid`, `visual aid`
- `mermaid`
- `diagram`, `chart`, `figure` (as label words)
- JSON structures
- Mermaid syntax
- Metadata patterns

### 3. Enhanced Instructions
The enhanced prompt includes:
- Clear role definition (teacher drawing on whiteboard)
- Extensive forbidden items list
- Content requirements (simple shapes, flowcharts)
- Text requirements (spelling accuracy)
- Style requirements (white background, bold strokes)
- Animation-friendly instructions

### 4. Voiceover Context Integration
If voiceover script exists, adds:
```
Voiceover context (add text labels in the diagram that support this narration): "[script]"
- Include key terms, labels, and short phrases from the voiceover in the diagram
- Make text labels visible and readable to support the narration
```

---

## Example Flow

**Input Topic**: "Polymorphism in C++"

**Step 1 - Structured Plan**:
```json
{
  "frames": [{
    "prompt_for_image": "A clear educational whiteboard diagram explaining polymorphism in C++ using geometric shapes..."
  }]
}
```

**Step 2 - First Sanitization**:
```
"A clear educational whiteboard explaining polymorphism in C++ using geometric shapes..."
```

**Step 3 - Enhanced Prompt**:
```
You are a teacher drawing on a WHITEBOARD...

DIAGRAM DESCRIPTION:
A clear educational whiteboard explaining polymorphism in C++ using geometric shapes...

Voiceover context: "Polymorphism allows objects of different types to be treated through the same interface..."
```

**Step 4 - Final Sanitization**:
(Same as Step 3, but double-checked for any remaining forbidden terms)

**Step 5 - API Call**:
```json
{
  "instances": [{
    "prompt": "[Enhanced prompt from Step 3]"
  }],
  "parameters": {
    "sampleCount": 1,
    "mimeType": "image/png",
    "aspectRatio": "16:9"
  }
}
```

---

## Error Handling

1. **RAI Filtering**: If content is filtered, tries next model in fallback chain
2. **Short Prompt**: If sanitization removes too much, uses fallback prompt
3. **Model Failures**: Tries models in order: imagen-4.0 → imagen-3.0 → imagen-2.0
4. **Rate Limiting**: Adds delays between API calls (3s base + 1s per frame)

---

## Summary

The prompt goes through **3 layers of sanitization** and **1 layer of enhancement** before reaching Imagen:

1. **Sanitization 1**: In structured plan generation
2. **Sanitization 2**: In video generation route (ultra-aggressive)
3. **Enhancement**: Adds comprehensive instructions and context
4. **Sanitization 3**: Final check before API call

This ensures:
- ✅ No metadata leakage (`visual_aid`, `mermaid`, etc.)
- ✅ Clean, educational prompts
- ✅ Animation-friendly instructions
- ✅ Proper spelling requirements
- ✅ White background requirements

