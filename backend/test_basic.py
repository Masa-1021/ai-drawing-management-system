"""
基本的な機能テスト

AWS接続、設定読み込み、プロンプト読み込みをテスト
"""

import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("Basic Function Test Started")
print("=" * 60)

# Test 1: Config Manager
print("\n[Test 1] ConfigManager")
try:
    from app.utils.config_manager import ConfigManager

    config = ConfigManager()
    print(f"OK - AWS Region: {config.aws_region}")
    print(f"OK - Model ID: {config.model_id}")
    print(f"OK - Database URL: {config.database_url}")
    print(f"OK - Confidence Threshold: {config.confidence_threshold}")
    print("OK - ConfigManager: PASSED")
except Exception as e:
    print(f"FAILED - ConfigManager: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 2: Prompt Manager
print("\n[Test 2] PromptManager")
try:
    from app.utils.prompt_manager import PromptManager

    pm = PromptManager()
    extraction_prompt = pm.format_prompt("extraction", extraction_fields="Test")

    if "CAD" in extraction_prompt and "Test" in extraction_prompt:
        print("OK - Prompt loaded")
        print(f"OK - Prompt length: {len(extraction_prompt)} chars")
    else:
        print("FAILED - Invalid prompt content")
        sys.exit(1)
except Exception as e:
    print(f"FAILED - PromptManager: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: AWS Boto3
print("\n[Test 3] AWS Boto3 Connection")
try:
    import boto3

    client = boto3.client("bedrock-runtime", region_name="us-west-2")
    print("OK - Boto3 Bedrock Runtime client created")
except Exception as e:
    print(f"FAILED - AWS connection: {e}")
    sys.exit(1)

# Test 4: Claude Client
print("\n[Test 4] ClaudeClient Initialization")
try:
    from app.services.claude_client import ClaudeClient

    claude = ClaudeClient(region="us-west-2")
    print(f"OK - ClaudeClient initialized")
    print(f"OK - Model ID: {claude.model_id}")
except Exception as e:
    print(f"FAILED - ClaudeClient: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 5: PDFConverter
print("\n[Test 5] PDFConverter Initialization")
try:
    from app.services.pdf_converter import PDFConverter

    converter = PDFConverter(dpi=300)
    print(f"OK - PDFConverter initialized")
    print(f"OK - DPI: {converter.dpi}")
    print(f"OK - Zoom: {converter.zoom}")
except Exception as e:
    print(f"FAILED - PDFConverter: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 6: AIAnalysisService
print("\n[Test 6] AIAnalysisService Initialization")
try:
    from app.services.ai_analysis_service import AIAnalysisService

    service = AIAnalysisService()
    print(f"OK - AIAnalysisService initialized")
except Exception as e:
    print(f"FAILED - AIAnalysisService: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("All Tests PASSED!")
print("=" * 60)
