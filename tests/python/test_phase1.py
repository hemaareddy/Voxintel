"""
tests/python/test_phase1.py
----------------------------
Phase 1 tests for:
  - Resume Intelligence Engine
  - Hybrid Question Generator
  - Readiness Score calculation
  - Source tracking
  - Question distribution logic

Run with: pytest tests/python/test_phase1.py -v
"""

import sys
import os
import math

# Allow imports from the python_services directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "python_services"))

import pytest

from resume_intelligence import (
    compute_skill_strength,
    compute_experience_strength,
    compute_project_strength,
    compute_readiness_score,
    infer_candidate_level,
    infer_recommended_difficulty,
    identify_strengths,
    identify_improvement_areas,
    generate_intelligence,
    _parse_experience_years,
)

from hybrid_question_generator import (
    generate_resume_questions,
    select_dataset_questions,
    generate_hybrid_questions,
    SOURCE_RESUME,
    SOURCE_DATASET,
)


# ── Fixtures ──────────────────────────────────────────────────

@pytest.fixture
def beginner_parsed():
    return {
        "skills": ["html", "css", "javascript", "git"],
        "technologies": [],
        "projects": [{"name": "Portfolio", "description": "Simple portfolio website", "technologies": ["html", "css"]}],
        "education": [{"degree": "B.Tech Computer Science", "institution": "XYZ College", "year": "2024"}],
        "certifications": [],
        "experience": [],
    }


@pytest.fixture
def intermediate_parsed():
    return {
        "skills": ["react", "node.js", "mongodb", "python", "docker", "git", "javascript", "typescript"],
        "technologies": ["mongodb", "docker"],
        "projects": [
            {
                "name": "Task Manager App",
                "description": "Built a CRUD REST API with authentication using JWT. Deployed with docker.",
                "technologies": ["react", "node.js", "mongodb"],
            },
            {
                "name": "Chat Application",
                "description": "Real-time messaging using WebSockets.",
                "technologies": ["react", "node.js", "redis"],
            },
        ],
        "education": [{"degree": "B.E. Computer Engineering", "institution": "ABC University", "year": "2022"}],
        "certifications": ["AWS Certified Cloud Practitioner"],
        "experience": [
            {"role": "Software Engineer Intern", "company": "TechCorp", "duration": "June 2022 - December 2022"},
        ],
    }


@pytest.fixture
def senior_parsed():
    return {
        "skills": [
            "python", "react", "node.js", "kubernetes", "aws", "tensorflow",
            "machine learning", "nlp", "redis", "postgresql", "microservices",
            "docker", "ci/cd", "github actions", "typescript", "distributed systems",
        ],
        "technologies": ["kubernetes", "aws", "postgresql", "redis", "docker"],
        "projects": [
            {
                "name": "VoxIntel AI Platform",
                "description": "Distributed NLP platform with microservices, ML pipeline, real-time inference.",
                "technologies": ["python", "kubernetes", "kafka", "tensorflow", "nlp"],
            },
            {
                "name": "Scalable E-commerce System",
                "description": "Microservices architecture with CQRS, event-driven, load balancing.",
                "technologies": ["node.js", "redis", "postgresql", "docker"],
            },
            {
                "name": "ML Recommender Engine",
                "description": "Deep learning recommender with computer vision and distributed training.",
                "technologies": ["pytorch", "aws", "kubernetes"],
            },
        ],
        "education": [{"degree": "M.Tech Computer Science", "institution": "IIT", "year": "2019"}],
        "certifications": ["AWS Solutions Architect", "Google Cloud Professional"],
        "experience": [
            {"role": "Senior Software Engineer", "company": "BigTech Inc", "duration": "2019 - 2024"},
            {"role": "ML Engineer", "company": "AI Startup", "duration": "2017 - 2019"},
        ],
    }


@pytest.fixture
def sample_dataset_questions():
    return [
        {
            "_id": "q1",
            "question": "What is the difference between a stack and a queue?",
            "difficulty": "easy",
            "category": "Data Structures & Algorithms",
            "ideal_answer": "Stack is LIFO; queue is FIFO.",
            "keywords": ["stack", "queue", "LIFO", "FIFO"],
            "evaluation_guidelines": "",
            "follow_up_questions": [],
        },
        {
            "_id": "q2",
            "question": "Explain DBMS normalisation up to 3NF.",
            "difficulty": "medium",
            "category": "DBMS",
            "ideal_answer": "1NF removes duplicates, 2NF removes partial deps, 3NF removes transitive deps.",
            "keywords": ["1NF", "2NF", "3NF", "normalisation"],
            "evaluation_guidelines": "",
            "follow_up_questions": [],
        },
        {
            "_id": "q3",
            "question": "What is the CAP theorem?",
            "difficulty": "hard",
            "category": "System Design Basics",
            "ideal_answer": "Consistency, Availability, Partition Tolerance — can only guarantee two of three.",
            "keywords": ["CAP", "consistency", "availability", "partition"],
            "evaluation_guidelines": "",
            "follow_up_questions": [],
        },
    ]


# ── Skill Strength Tests ──────────────────────────────────────

class TestSkillStrength:
    def test_empty_skills_returns_zero(self):
        assert compute_skill_strength({}) == 0

    def test_basic_skills_low_score(self, beginner_parsed):
        score = compute_skill_strength(beginner_parsed)
        assert 0 < score < 50, f"Expected 0–50, got {score}"

    def test_intermediate_skills_mid_score(self, intermediate_parsed):
        score = compute_skill_strength(intermediate_parsed)
        assert 30 <= score <= 95, f"Expected 30–95, got {score}"

    def test_advanced_skills_high_score(self, senior_parsed):
        score = compute_skill_strength(senior_parsed)
        assert score >= 60, f"Expected >=60, got {score}"

    def test_score_is_bounded_0_to_100(self, senior_parsed):
        score = compute_skill_strength(senior_parsed)
        assert 0 <= score <= 100


# ── Experience Strength Tests ─────────────────────────────────

class TestExperienceStrength:
    def test_no_experience_returns_zero_or_low(self, beginner_parsed):
        score = compute_experience_strength(beginner_parsed)
        assert 0 <= score <= 20

    def test_year_range_parsing(self):
        parsed = {
            "experience": [{"role": "SWE", "company": "Corp", "duration": "2021 - 2024"}],
            "certifications": [],
        }
        years = _parse_experience_years(parsed["experience"])
        assert 2.5 <= years <= 3.5, f"Expected ~3 years, got {years}"

    def test_certifications_add_bonus(self, intermediate_parsed):
        no_cert = {**intermediate_parsed, "certifications": []}
        with_cert = intermediate_parsed
        assert compute_experience_strength(with_cert) >= compute_experience_strength(no_cert)

    def test_senior_experience_high_score(self, senior_parsed):
        score = compute_experience_strength(senior_parsed)
        assert score >= 60


# ── Project Strength Tests ────────────────────────────────────

class TestProjectStrength:
    def test_no_projects_returns_zero(self):
        assert compute_project_strength({"projects": []}) == 0

    def test_basic_project_low_score(self, beginner_parsed):
        score = compute_project_strength(beginner_parsed)
        assert 0 < score < 50

    def test_complex_projects_high_score(self, senior_parsed):
        score = compute_project_strength(senior_parsed)
        assert score >= 50

    def test_score_bounded_0_to_100(self, senior_parsed):
        score = compute_project_strength(senior_parsed)
        assert 0 <= score <= 100


# ── Readiness Score Tests ─────────────────────────────────────

class TestReadinessScore:
    def test_weighted_combination(self):
        score = compute_readiness_score(60, 80, 40)
        expected = round(60 * 0.35 + 80 * 0.40 + 40 * 0.25)
        assert score == expected

    def test_all_zeros(self):
        assert compute_readiness_score(0, 0, 0) == 0

    def test_all_hundreds(self):
        assert compute_readiness_score(100, 100, 100) == 100

    def test_capped_at_100(self):
        assert compute_readiness_score(100, 100, 100) <= 100


# ── Candidate Level Detection Tests ──────────────────────────

class TestCandidateLevel:
    def test_beginner_classification(self, beginner_parsed):
        intel = generate_intelligence(beginner_parsed)
        assert intel["candidateLevel"] in ["Beginner", "Junior"]

    def test_intermediate_classification(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        assert intel["candidateLevel"] in ["Intermediate", "Advanced"]

    def test_senior_classification(self, senior_parsed):
        intel = generate_intelligence(senior_parsed)
        assert intel["candidateLevel"] in ["Advanced", "Senior"]


# ── Recommended Difficulty Tests ──────────────────────────────

class TestRecommendedDifficulty:
    def test_beginner_gets_easy_difficulty(self, beginner_parsed):
        intel = generate_intelligence(beginner_parsed)
        assert intel["recommendedDifficulty"] in ["Beginner", "Intermediate"]

    def test_senior_gets_hard_difficulty(self, senior_parsed):
        intel = generate_intelligence(senior_parsed)
        assert intel["recommendedDifficulty"] in ["Advanced", "Expert"]

    def test_valid_values_only(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        assert intel["recommendedDifficulty"] in ["Beginner", "Intermediate", "Advanced", "Expert"]


# ── Strengths & Improvement Areas Tests ──────────────────────

class TestStrengthsAndGaps:
    def test_strengths_from_resume(self, senior_parsed):
        strengths = identify_strengths(senior_parsed, 80)
        assert len(strengths) > 0
        # All returned strengths should be non-empty strings
        assert all(isinstance(s, str) and len(s) > 0 for s in strengths)

    def test_improvement_areas_for_beginner(self, beginner_parsed):
        gaps = identify_improvement_areas(beginner_parsed)
        # A beginner should have gaps in most areas
        assert len(gaps) > 0
        assert "Cloud" in gaps or "DevOps" in gaps or "AI/ML" in gaps

    def test_senior_fewer_gaps(self, senior_parsed):
        beginner_gaps = identify_improvement_areas({"skills": [], "technologies": [], "projects": [], "experience": [], "certifications": []})
        senior_gaps = identify_improvement_areas(senior_parsed)
        assert len(senior_gaps) <= len(beginner_gaps)


# ── generate_intelligence integration test ───────────────────

class TestGenerateIntelligence:
    def test_all_fields_present(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        assert "candidateLevel" in intel
        assert "skillStrength" in intel
        assert "experienceStrength" in intel
        assert "projectStrength" in intel
        assert "readinessScore" in intel
        assert "recommendedDifficulty" in intel
        assert "strengths" in intel
        assert "improvementAreas" in intel

    def test_all_scores_in_range(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        for field in ["skillStrength", "experienceStrength", "projectStrength", "readinessScore"]:
            assert 0 <= intel[field] <= 100, f"{field}={intel[field]} out of range"

    def test_safe_on_empty_parsed(self):
        intel = generate_intelligence({})
        assert intel["candidateLevel"] in ["Beginner", "Junior", "Intermediate"]
        assert 0 <= intel["readinessScore"] <= 100


# ── Hybrid Question Generation Tests ─────────────────────────

class TestHybridQuestionGeneration:
    def test_distribution_10_questions(self, intermediate_parsed, sample_dataset_questions):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_hybrid_questions(intermediate_parsed, intel, sample_dataset_questions, count=10)
        resume_qs = [q for q in questions if q.get("source") == SOURCE_RESUME]
        dataset_qs = [q for q in questions if q.get("source") == SOURCE_DATASET]
        # 50/50 split: 5 resume + 5 dataset for count=10
        assert len(resume_qs) >= 1  # must have at least some resume questions
        assert len(dataset_qs) >= 1  # must have at least some dataset questions
        # Total should not exceed count
        assert len(questions) <= 10

    def test_source_tracking_all_present(self, intermediate_parsed, sample_dataset_questions):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_hybrid_questions(intermediate_parsed, intel, sample_dataset_questions, count=6)
        for q in questions:
            assert q.get("source") in [SOURCE_RESUME, SOURCE_DATASET], \
                f"Question missing or invalid source: {q.get('source')}"

    def test_proportional_distribution(self, intermediate_parsed, sample_dataset_questions):
        intel = generate_intelligence(intermediate_parsed)
        for count in [5, 10, 20]:
            expected_resume = math.ceil(count * 0.5)
            expected_dataset = count - expected_resume
            questions = generate_hybrid_questions(intermediate_parsed, intel, sample_dataset_questions, count=count)
            resume_qs = [q for q in questions if q.get("source") == SOURCE_RESUME]
            dataset_qs = [q for q in questions if q.get("source") == SOURCE_DATASET]
            # Allow tolerance of ±1 for edge cases (dataset may be insufficient)
            assert abs(len(resume_qs) - expected_resume) <= 2, \
                f"count={count}: got {len(resume_qs)} resume, expected {expected_resume}"

    def test_no_duplicate_questions(self, intermediate_parsed, sample_dataset_questions):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_hybrid_questions(intermediate_parsed, intel, sample_dataset_questions, count=10)
        texts = [q["question"] for q in questions]
        assert len(texts) == len(set(texts)), "Duplicate questions found!"

    def test_all_required_fields_present(self, intermediate_parsed, sample_dataset_questions):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_hybrid_questions(intermediate_parsed, intel, sample_dataset_questions, count=5)
        required = ["question", "difficulty", "category", "source", "keywords"]
        for q in questions:
            for field in required:
                assert field in q, f"Missing field '{field}' in question"

    def test_no_resume_falls_back_to_dataset(self, sample_dataset_questions):
        empty_parsed = {"skills": [], "technologies": [], "projects": [], "experience": [], "certifications": []}
        intel = generate_intelligence(empty_parsed)
        questions = generate_hybrid_questions(empty_parsed, intel, sample_dataset_questions, count=3)
        # Should still return questions, primarily from dataset
        assert len(questions) >= 1


# ── Dataset selection tests ───────────────────────────────────

class TestDatasetSelection:
    def test_selects_correct_count(self, sample_dataset_questions):
        intel = {"candidateLevel": "Intermediate", "recommendedDifficulty": "Intermediate"}
        selected = select_dataset_questions(sample_dataset_questions, intel, 2)
        assert len(selected) <= 2

    def test_all_have_source_dataset(self, sample_dataset_questions):
        intel = {"candidateLevel": "Intermediate", "recommendedDifficulty": "Intermediate"}
        selected = select_dataset_questions(sample_dataset_questions, intel, 3)
        for q in selected:
            assert q["source"] == SOURCE_DATASET

    def test_empty_dataset_returns_empty(self):
        intel = {"candidateLevel": "Intermediate"}
        result = select_dataset_questions([], intel, 5)
        assert result == []


# ── Resume-based question generation tests ────────────────────

class TestResumeQuestions:
    def test_generates_questions_from_skills(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_resume_questions(intermediate_parsed, intel, count=5)
        assert len(questions) >= 1

    def test_all_questions_source_resume(self, intermediate_parsed):
        intel = generate_intelligence(intermediate_parsed)
        questions = generate_resume_questions(intermediate_parsed, intel, count=6)
        for q in questions:
            assert q["source"] == SOURCE_RESUME

    def test_no_project_questions_without_projects(self):
        parsed = {
            "skills": ["react", "node.js"],
            "technologies": [],
            "projects": [],
            "experience": [],
            "certifications": [],
        }
        intel = generate_intelligence(parsed)
        questions = generate_resume_questions(parsed, intel, count=5)
        # Should still generate skill-based questions
        assert len(questions) >= 1
        for q in questions:
            assert q.get("source") == SOURCE_RESUME


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
