"""
tests/python/test_followup_generator.py
-----------------------------------------
Tests for the adaptive follow-up question generator: it should react to
which keywords the candidate's answer did or didn't cover.

Run with: pytest tests/python/test_followup_generator.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_services"))

from followup_generator import generate_followup_question, _keyword_coverage


class TestKeywordCoverage:
    def test_matched_and_missing_split_correctly(self):
        matched, missing = _keyword_coverage("I used React and Redux.", ["React", "Redux", "useEffect"])
        assert matched == ["React", "Redux"]
        assert missing == ["useEffect"]

    def test_is_case_insensitive(self):
        matched, missing = _keyword_coverage("i used REACT", ["React"])
        assert matched == ["React"]
        assert missing == []

    def test_word_boundary_avoids_partial_matches(self):
        # "react" should not match inside "reaction"
        matched, missing = _keyword_coverage("My reaction was strong.", ["react"])
        assert matched == []
        assert missing == ["react"]


class TestGenerateFollowupQuestion:
    def test_asks_about_a_missing_keyword_when_any_are_missing(self):
        result = generate_followup_question("I used React for the UI.", ["React", "Redux"])
        assert result["based_on"] == "missing:Redux"
        assert "Redux" in result["question"]

    def test_asks_to_go_deeper_on_a_matched_keyword_when_all_covered(self):
        result = generate_followup_question("I used React and Redux together.", ["React", "Redux"])
        assert result["based_on"] in ("matched:React", "matched:Redux")
        matched_kw = result["based_on"].split(":", 1)[1]
        assert matched_kw in result["question"]

    def test_falls_back_to_generic_probe_when_no_keywords(self):
        result = generate_followup_question("Some answer with no keywords to check.", [])
        assert result["based_on"] == "generic"
        assert result["question"]  # non-empty

    def test_handles_empty_answer_gracefully(self):
        result = generate_followup_question("", ["React"])
        assert result["based_on"] == "missing:React"
