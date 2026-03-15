"""Tests for the validation pipeline."""

import pytest

from aegisforge.validation.syntax import SyntaxValidator
from aegisforge.validation.imports import ImportValidator
from aegisforge.validation.schema import SchemaValidator
from aegisforge.validation.pipeline import ValidationPipeline, ValidationResult


class TestSyntaxValidator:
    @pytest.mark.asyncio
    async def test_valid_python(self):
        v = SyntaxValidator()
        errors = await v.validate("x = 1\nprint(x)", "python")
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_python(self):
        v = SyntaxValidator()
        errors = await v.validate("def foo(:\n    pass", "python")
        assert len(errors) == 1
        assert errors[0]["severity"] == "error"

    @pytest.mark.asyncio
    async def test_valid_json(self):
        v = SyntaxValidator()
        errors = await v.validate('{"key": "value"}', "json")
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_json(self):
        v = SyntaxValidator()
        errors = await v.validate("{bad json}", "json")
        assert len(errors) == 1

    @pytest.mark.asyncio
    async def test_unsupported_language_no_error(self):
        v = SyntaxValidator()
        errors = await v.validate("anything", "rust")
        assert errors == []

    @pytest.mark.asyncio
    async def test_multiline_valid_python(self):
        code = '''
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

class Calculator:
    def __init__(self):
        self.history = []
'''
        v = SyntaxValidator()
        assert await v.validate(code, "python") == []


class TestImportValidator:
    @pytest.mark.asyncio
    async def test_stdlib_imports_resolve(self):
        v = ImportValidator()
        code = "import os\nimport sys\nfrom pathlib import Path"
        errors = await v.validate(code)
        assert errors == []

    @pytest.mark.asyncio
    async def test_installed_package_resolves(self):
        v = ImportValidator()
        code = "import pydantic"
        errors = await v.validate(code)
        assert errors == []

    @pytest.mark.asyncio
    async def test_fake_package_fails(self):
        v = ImportValidator()
        code = "from nonexistent_magic_lib import sparkles"
        errors = await v.validate(code)
        assert len(errors) == 1
        assert "nonexistent_magic_lib" in errors[0]["message"]

    @pytest.mark.asyncio
    async def test_allowed_missing_skipped(self):
        v = ImportValidator(allowed_missing={"my_internal_lib"})
        code = "from my_internal_lib import utils"
        errors = await v.validate(code)
        assert errors == []

    @pytest.mark.asyncio
    async def test_non_python_returns_empty(self):
        v = ImportValidator()
        errors = await v.validate("import anything", language="javascript")
        assert errors == []

    def test_get_imports(self):
        v = ImportValidator()
        code = "import os\nfrom pathlib import Path\nimport json"
        imports = v.get_imports(code)
        assert set(imports) == {"os", "pathlib", "json"}


class TestSchemaValidator:
    @pytest.mark.asyncio
    async def test_valid_json_with_fields(self):
        v = SchemaValidator()
        errors = await v.validate_json('{"name": "test", "value": 42}', ["name", "value"])
        assert errors == []

    @pytest.mark.asyncio
    async def test_missing_required_field(self):
        v = SchemaValidator()
        errors = await v.validate_json('{"name": "test"}', ["name", "value"])
        assert len(errors) == 1
        assert "value" in errors[0]["message"]

    @pytest.mark.asyncio
    async def test_invalid_json(self):
        v = SchemaValidator()
        errors = await v.validate_json("not json", None)
        assert len(errors) == 1

    @pytest.mark.asyncio
    async def test_validate_dict_types(self):
        v = SchemaValidator()
        errors = await v.validate_dict(
            {"name": "test", "count": "not_int"},
            schema={"name": str, "count": int},
        )
        assert len(errors) == 1
        assert "count" in errors[0]["message"]

    def test_extract_json_from_fences(self):
        v = SchemaValidator()
        text = '```json\n{"key": "value"}\n```'
        result = v.extract_json(text)
        assert result == {"key": "value"}

    def test_extract_json_plain(self):
        v = SchemaValidator()
        result = v.extract_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_extract_json_returns_none_for_garbage(self):
        v = SchemaValidator()
        result = v.extract_json("just some text")
        assert result is None


class TestValidationPipeline:
    @pytest.mark.asyncio
    async def test_valid_code_passes(self):
        pipeline = ValidationPipeline()
        result = await pipeline.validate_code(
            "x = 1\nprint(x)", "python", skip_self_review=True
        )
        assert result.passed
        assert result.error_count == 0

    @pytest.mark.asyncio
    async def test_syntax_error_fails(self):
        pipeline = ValidationPipeline()
        result = await pipeline.validate_code(
            "def bad(:\n    pass", "python", skip_self_review=True
        )
        assert not result.passed
        assert result.error_count >= 1
        assert any(e.validator == "syntax" for e in result.errors)

    @pytest.mark.asyncio
    async def test_bad_import_caught(self):
        pipeline = ValidationPipeline()
        result = await pipeline.validate_code(
            "from hallucinated_module import magic\nx = magic()",
            "python",
            skip_self_review=True,
        )
        assert any(e.validator == "imports" for e in result.errors)

    @pytest.mark.asyncio
    async def test_validate_structured_output(self):
        pipeline = ValidationPipeline()
        result = await pipeline.validate_structured_output(
            '{"code": "x=1", "language": "python"}',
            required_fields=["code", "language"],
            task_type="code_generation",
        )
        assert result.passed

    @pytest.mark.asyncio
    async def test_validate_structured_output_missing(self):
        pipeline = ValidationPipeline()
        result = await pipeline.validate_structured_output(
            '{"code": "x=1"}',
            required_fields=["code", "language"],
        )
        assert not result.passed

    @pytest.mark.asyncio
    async def test_result_summary(self):
        result = ValidationResult(passed=True, iteration=1)
        assert "passed" in result.summary()

        result2 = ValidationResult(passed=False, iteration=2)
        assert "failed" in result2.summary()
