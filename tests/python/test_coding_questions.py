"""
tests/python/test_coding_questions.py
---------------------------------------
Tests for the static coding question bank and its selection logic.

Run with: pytest tests/python/test_coding_questions.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_services"))

from coding_questions import CODING_QUESTIONS
from coding_question_generator import generate_coding_questions, SOURCE_RESUME, SOURCE_DATASET


class TestCodingQuestionBank:
    def test_every_problem_has_required_fields(self):
        required = [
            "id", "title", "difficulty", "category", "skill_tags", "prompt",
            "function_name", "starter_code", "test_cases", "hidden_test_cases",
            "expected_concepts",
        ]
        for q in CODING_QUESTIONS:
            for field in required:
                assert field in q, f"{q.get('id')} missing '{field}'"

    def test_no_duplicate_ids(self):
        ids = [q["id"] for q in CODING_QUESTIONS]
        assert len(ids) == len(set(ids))

    def test_every_problem_has_test_cases(self):
        for q in CODING_QUESTIONS:
            assert len(q["test_cases"]) >= 1
            assert len(q["hidden_test_cases"]) >= 1


class TestCodingQuestionSelection:
    def test_returns_requested_count(self):
        questions = generate_coding_questions(["javascript"], count=8)
        assert len(questions) == 8

    def test_caps_at_bank_size_without_repeats(self):
        big_count = len(CODING_QUESTIONS) + 5
        questions = generate_coding_questions([], count=big_count)
        ids = [q["id"] for q in questions]
        assert len(questions) == len(CODING_QUESTIONS)
        assert len(ids) == len(set(ids))

    def test_roughly_60_40_split(self):
        questions = generate_coding_questions([], count=10)
        resume_qs = [q for q in questions if q["source"] == SOURCE_RESUME]
        dataset_qs = [q for q in questions if q["source"] == SOURCE_DATASET]
        assert len(dataset_qs) == 6
        assert len(resume_qs) == 4

    def test_prioritizes_skill_matched_problems_in_resume_bucket(self):
        # "stacks" only tags valid-parentheses — with a small resume bucket,
        # that problem should be the one selected as resume-sourced.
        questions = generate_coding_questions(["stacks"], count=10)
        resume_ids = {q["id"] for q in questions if q["source"] == SOURCE_RESUME}
        assert "valid-parentheses" in resume_ids

    def test_no_skill_match_still_fills_resume_bucket(self):
        questions = generate_coding_questions(["cobol", "fortran"], count=10)
        resume_qs = [q for q in questions if q["source"] == SOURCE_RESUME]
        assert len(resume_qs) == 4

    def test_all_questions_marked_type_coding(self):
        questions = generate_coding_questions(["javascript"], count=5)
        assert all(q["type"] == "coding" for q in questions)

    def test_no_duplicate_problems_within_a_session(self):
        questions = generate_coding_questions(["javascript", "react"], count=10)
        ids = [q["id"] for q in questions]
        assert len(ids) == len(set(ids))
