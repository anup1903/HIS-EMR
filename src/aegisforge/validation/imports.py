"""Import validation — checks that generated code imports actually resolve."""

from __future__ import annotations

import ast
import importlib.util
import sys

import structlog

logger = structlog.get_logger()

# Standard library modules that are always available
_STDLIB_MODULES: set[str] | None = None


def _get_stdlib_modules() -> set[str]:
    """Get the set of standard library module names."""
    global _STDLIB_MODULES
    if _STDLIB_MODULES is None:
        _STDLIB_MODULES = set(sys.stdlib_module_names)
    return _STDLIB_MODULES


class ImportValidator:
    """Validates that imports in generated code resolve to real modules.

    Catches hallucinated imports like `from nonexistent_lib import magic`.
    """

    def __init__(self, allowed_missing: set[str] | None = None) -> None:
        self._allowed_missing = allowed_missing or set()

    async def validate(
        self,
        code: str,
        language: str = "python",
    ) -> list[dict[str, str | int | None]]:
        """Check all imports in the code resolve. Returns list of unresolvable imports.

        Each error dict has: message, line, module, severity.
        """
        if language != "python":
            return []

        try:
            tree = ast.parse(code)
        except SyntaxError:
            # Syntax errors are caught by SyntaxValidator
            return []

        errors: list[dict[str, str | int | None]] = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if not self._can_resolve(alias.name):
                        errors.append({
                            "message": f"Cannot resolve import: {alias.name}",
                            "line": node.lineno,
                            "module": alias.name,
                            "severity": "error",
                        })

            elif isinstance(node, ast.ImportFrom):
                if node.module and not self._can_resolve(node.module):
                    errors.append({
                        "message": f"Cannot resolve module: {node.module}",
                        "line": node.lineno,
                        "module": node.module,
                        "severity": "error",
                    })

        if errors:
            logger.warning(
                "imports.unresolvable",
                count=len(errors),
                modules=[e["module"] for e in errors],
            )

        return errors

    def _can_resolve(self, module_name: str) -> bool:
        """Check if a module can be resolved."""
        top_level = module_name.split(".")[0]

        # Allow explicitly permitted missing modules
        if top_level in self._allowed_missing:
            return True

        # Standard library
        if top_level in _get_stdlib_modules():
            return True

        # Try to find the module spec without importing it
        try:
            spec = importlib.util.find_spec(top_level)
            return spec is not None
        except (ModuleNotFoundError, ValueError):
            return False

    def get_imports(self, code: str) -> list[str]:
        """Extract all import module names from code."""
        try:
            tree = ast.parse(code)
        except SyntaxError:
            return []

        imports: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.append(node.module)
        return imports


def get_import_validator(
    allowed_missing: set[str] | None = None,
) -> ImportValidator:
    """Create an ImportValidator.

    Args:
        allowed_missing: Module names to skip validation for
            (e.g., project-internal modules that might not be installed locally).
    """
    return ImportValidator(allowed_missing=allowed_missing)
