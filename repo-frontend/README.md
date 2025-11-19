# PPT Translation App

A Next.js-based web application for translating PowerPoint presentations with AI-powered translation and real-time preview.

## Features

- 📤 **Upload PPTX Files**: Upload PowerPoint files and automatically extract text elements
- 🤖 **AI Translation**: Translate text using Replicate API (GPT-5 model)
- ✏️ **Inline Editing**: Edit translations directly with batch update support
- 📝 **XML-Level Writing**: Write translations back to PPTX at XML level for perfect formatting preservation
- 🖼️ **Preview Generation**: Generate preview images for both original and translated slides
- 📥 **Download**: Download translated PPTX files
- 🔍 **Rescan**: Re-parse PPTX to extract all paragraphs separately
- 🎨 **Modern UI**: Thumbnail navigation with side-by-side preview comparison
- 🔐 **Authentication**: User login and registration system

## Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API Routes
- **Translation**: Replicate API (GPT-5)
- **PPTX Processing**: Python (XML manipulation)
- **Preview Generation**: LibreOffice
- **File Parsing**: adm-zip, fast-xml-parser

## Prerequisites

- Node.js 16+
- Python 3.8+
- LibreOffice (for preview generation)
- Replicate API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/sourit2001/PPT-translate.git
cd PPT-translate
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Set up Python virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install python-pptx lxml
```

4. Create `.env.local` file:
```env
REPLICATE_API_TOKEN=your_replicate_api_token_here
```

5. Create data directories:
```bash
mkdir -p .data/originals .data/translated .data/previews .data/previews-translated .data/temp
```

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:3000 in your browser

3. Upload a PPTX file

4. Click on any page thumbnail to view it

5. Click "🚀 翻译当前页" to translate the current page

6. Click "🔄 更新预览" to generate translated preview images

7. Click "📥 下载" to download the translated PPTX file

## Project Structure

```
.
├── pages/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── element/       # Single element operations
│   │   ├── elements/      # Batch element operations
│   │   ├── project/       # Project operations
│   │   ├── preview/       # Preview image serving
│   │   └── upload.ts      # File upload
│   ├── index.tsx          # Home page
│   ├── login.tsx          # Login page
│   ├── register.tsx       # Register page
│   └── project/[id].tsx   # Project detail page
├── lib/
│   ├── data.ts            # Data structures and persistence
│   ├── parsePptx.ts       # PPTX parsing logic
│   ├── updatePptx.ts      # PPTX update wrapper
│   ├── generatePreviews.ts # Preview generation
│   └── session.ts         # Session management
├── scripts/
│   └── update_pptx.py     # Python script for XML-level PPTX editing
└── .data/                 # Data storage (gitignored)
    ├── originals/         # Original PPTX files
    ├── translated/        # Translated PPTX files
    ├── previews/          # Original preview images
    └── previews-translated/ # Translated preview images
```

## Key Features Explained

### Text Extraction
- Parses PPTX files at XML level
- Extracts text from slides, layouts, masters, SmartArt, and charts
- Groups text by paragraphs while preserving structure
- Filters out symbols and bullet points

### Translation
- Uses Replicate API with GPT-5 model
- Supports batch translation
- Preserves already translated content
- Allows inline editing before confirmation

### Write-Back Mechanism
- Matches translated text to original text in PPTX XML
- Supports exact matching, substring matching, and reverse matching
- Preserves formatting, styles, and layout
- Handles multi-paragraph text boxes correctly

### Preview Generation
- Uses LibreOffice to convert PPTX slides to PNG images
- Generates previews for both original and translated versions
- Caches previews for performance
- Updates previews after translation changes

## API Endpoints

- `POST /api/upload` - Upload PPTX file
- `GET /api/project?id={id}` - Get project details
- `POST /api/project/rescan` - Re-parse PPTX with updated logic
- `POST /api/element/translate` - Translate single element
- `PATCH /api/element/update` - Update single element translation
- `POST /api/elements/batch-update` - Batch update translations
- `POST /api/project/regenerate-preview` - Write translations and regenerate previews
- `GET /api/project/download?projectId={id}` - Download translated PPTX
- `GET /api/preview/{projectId}/{slideIndex}` - Get original preview image
- `GET /api/preview-translated/{projectId}/{slideIndex}` - Get translated preview image

## Configuration

### Replicate API
The app uses Replicate's GPT-5 model for translation. You need to:
1. Sign up at https://replicate.com
2. Get your API token
3. Add it to `.env.local`

### LibreOffice
Preview generation requires LibreOffice to be installed:
- macOS: `brew install --cask libreoffice`
- Ubuntu: `sudo apt-get install libreoffice`
- Windows: Download from https://www.libreoffice.org/

## Troubleshooting

### Translations not appearing in preview
1. Check console logs for matching errors
2. Click "🔍 重新扫描" to re-parse the PPTX
3. Verify translations are saved (check for "未提交修改" warnings)
4. Click "🔄 更新预览" to regenerate preview images

### Preview images not loading
1. Ensure LibreOffice is installed
2. Check `.data/previews` and `.data/previews-translated` directories
3. Look for errors in server console

### Upload fails
1. Check file size (default limit: 20MB)
2. Verify PPTX file is not corrupted
3. Ensure `.data/originals` directory exists

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Created by sourit2001
