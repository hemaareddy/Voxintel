"""
tests/python/test_code_followup_generator.py
-----------------------------------------------
Run with: pytest tests/python/test_code_followup_generator.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_services"))

from code_followup_generator import generate_code_followup


class TestGenerateCodeFollowup:
    def test_all_passed_with_concepts_references_a_concept(self):
        result = generate_code_followup(3, 3, ["hash map", "time complexity"])
        assert result["based_on"].startswith("correct:")
        concept = result["based_on"].split(":", 1)[1]
        assert concept in ["hash map", "time complexity"]
        assert concept in result["question"]

    def test_all_passed_without_concepts_falls_back_to_generic_probe(self):
        result = generate_code_followup(2, 2, [])
        assert result["based_on"] == "correct:generic"
        assert result["question"]

    def test_public_failure_references_its_specific_input(self):
        failure = {"args": [[1, 2], 5], "expected": [0, 1]}
        result = generate_code_followup(1, 3, ["hash map"], first_public_failure=failure)
        assert result["based_on"] == "failed:public"
        assert "[1, 2], 5" in result["question"] or str(failure["args"]) in result["question"]

    def test_hidden_only_failure_never_leaks_hidden_details(self):
        result = generate_code_followup(2, 3, ["hash map"], first_public_failure=None)
        assert result["based_on"] == "failed:hidden"
        # generic edge-case prompt, no specific inputs/outputs mentioned
        assert "expected" not in result["question"].lower()

    def test_zero_total_does_not_claim_success(self):
        result = generate_code_followup(0, 0, [])
        assert result["based_on"] != "correct:generic"
