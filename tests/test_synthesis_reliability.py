"""Failure and evidence-boundary regression tests; no external services required."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from app.services.agents.synthesis import (
    SynthesisError,
    _analyze_cluster,
    _assess_data_quality,
    _categorize_and_compile,
    _cluster,
    _embed_signals,
    _llm_cluster,
    synthesize_patterns,
)
from tests.conftest import make_mock_react_llm, make_signals


def test_embedding_failure_does_not_create_random_vectors():
    with (
        patch("app.services.agents.synthesis.get_embeddings", side_effect=RuntimeError("offline")),
        pytest.raises(SynthesisError, match="embeddings unavailable"),
    ):
        _embed_signals(make_signals(2))


@pytest.mark.parametrize("vectors", [[], [[1.0]], [[0.0], [0.0]], [[float("nan")], [1.0]]])
def test_malformed_embeddings_are_rejected(vectors):
    model = MagicMock()
    model.embed_documents.return_value = vectors
    with (
        patch("app.services.agents.synthesis.get_embeddings", return_value=model),
        pytest.raises(SynthesisError),
    ):
        _embed_signals(make_signals(2))


def test_kmeans_failure_does_not_invent_groups():
    with (
        patch("sklearn.cluster.KMeans.fit_predict", side_effect=ValueError("invalid data")),
        pytest.raises(SynthesisError, match="clustering failed"),
    ):
        _cluster(np.eye(4), 2)


def test_kmeans_uses_real_geometry_and_is_repeatable():
    points = np.array([[1, 1], [1, 1.1], [1.1, 1], [9, 9], [9, 9.1], [9.1, 9]])
    labels = _cluster(points, 2)
    assert len(set(labels[:3])) == 1
    assert len(set(labels[3:])) == 1
    assert labels[0] != labels[3]
    assert labels == _cluster(points, 2)


def test_identical_vectors_form_one_cluster():
    assert _cluster(np.ones((5, 3)), 3) == [0] * 5


@pytest.mark.parametrize(
    "groups",
    [
        [],
        [{"cluster_id": 0, "signal_indices": [0, 0, 1]}],
        [{"cluster_id": 0, "signal_indices": [-1, 0]}],
        [{"cluster_id": 0, "signal_indices": [0, 2]}],
        [{"cluster_id": 0, "signal_indices": [0]}],
        [{"cluster_id": 0, "signal_indices": [0]}, {"cluster_id": 0, "signal_indices": [1]}],
        [{"cluster_id": 0, "signal_indices": [False, 1]}],
        [{"cluster_id": 0, "signal_indices": []}],
    ],
)
async def test_llm_grouping_rejects_invalid_partitions(groups):
    import json

    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=SimpleNamespace(content=json.dumps({"groups": groups})))
    with pytest.raises(SynthesisError, match="grouping failed"):
        await _llm_cluster(make_signals(2), llm)


async def test_llm_grouping_preserves_all_signals_once():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=SimpleNamespace(
            content='{"groups":[{"cluster_id":8,"signal_indices":[1]},{"cluster_id":3,"signal_indices":[0]}]}'
        )
    )
    signals = make_signals(2)
    assert await _llm_cluster(signals, llm) == {8: [signals[1]], 3: [signals[0]]}


async def test_positive_feedback_does_not_force_problem_categories():
    llm = make_mock_react_llm({})
    with patch("app.services.agents.synthesis.get_strong_llm", return_value=llm):
        report = await synthesize_patterns([{"raw_text": "Thanks, it works well.", "pain": ""}])
    assert report["critical_issues"] == []
    assert report["valuable_insights"] == []
    assert report["future_opportunities"] == []
    assert report["clusters"] == []
    assert report["top_pains"] == []


async def test_direct_analysis_failure_is_retryable():
    llm = make_mock_react_llm({})
    llm.with_structured_output.return_value.ainvoke.side_effect = RuntimeError("provider down")
    with (
        patch("app.services.agents.synthesis.get_strong_llm", return_value=llm),
        pytest.raises(SynthesisError, match="analysis failed"),
    ):
        await synthesize_patterns(make_signals(1))


async def test_cluster_analysis_failure_does_not_fabricate_confidence_or_evidence():
    llm = make_mock_react_llm({})
    llm.with_structured_output.return_value.ainvoke.side_effect = RuntimeError("provider down")
    with pytest.raises(SynthesisError, match="cluster could not"):
        await _analyze_cluster(0, make_signals(2), llm)
    with pytest.raises(SynthesisError, match="categorization failed"):
        await _categorize_and_compile([{"label": "Slow dashboard"}], make_signals(2), llm)


async def test_large_batch_embedding_failure_stops_before_clustering():
    signals = [{"pain": f"Feedback {i}"} for i in range(16)]
    with (
        patch("app.services.agents.synthesis.get_strong_llm"),
        patch(
            "app.services.agents.synthesis._embed_signals", side_effect=SynthesisError("offline")
        ),
        patch("app.services.agents.synthesis._cluster") as cluster,
    ):
        with pytest.raises(SynthesisError, match="offline"):
            await synthesize_patterns(signals)
        cluster.assert_not_called()


def test_sample_size_is_not_claimed_as_verified_accuracy():
    assert _assess_data_quality(500)["confidence"] == "unassessed"
