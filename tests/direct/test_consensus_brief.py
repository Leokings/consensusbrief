"""Fast state and validation tests for ConsensusBrief."""

import json


CONTRACT = "contracts/consensus_brief.py"


def _source(words: int) -> str:
    return " ".join(f"source-{index}" for index in range(words))


def _words(prefix: str, count: int) -> str:
    return " ".join(f"{prefix}-{index}" for index in range(count))


def _compact_words(prefix: str, count: int) -> str:
    return " ".join(f"{prefix}{index}" for index in range(count))


def _compact_source(words: int) -> str:
    return " ".join("source" for _ in range(words))


def _candidate(prefix: str = "brief") -> dict[str, object]:
    return {
        "title": "A grounded working brief",
        "executive_summary": _words(f"{prefix}-summary", 60),
        "shared_ground": [
            _words(f"{prefix}-ground-a", 15),
            _words(f"{prefix}-ground-b", 15),
            _words(f"{prefix}-ground-c", 15),
        ],
        "key_considerations": [
            _words(f"{prefix}-consideration-a", 15),
            _words(f"{prefix}-consideration-b", 15),
        ],
        "open_questions": [_words(f"{prefix}-question", 15)],
        "recommended_next_step": _words(f"{prefix}-next", 15),
    }


def _short_candidate() -> dict[str, object]:
    return {
        "title": "Too short",
        "executive_summary": "short",
        "shared_ground": ["one", "two", "three"],
        "key_considerations": ["four", "five"],
        "open_questions": ["six"],
        "recommended_next_step": "seven",
    }


def _expanded_candidate() -> dict[str, object]:
    return {
        "title": "An expanded grounded brief",
        "executive_summary": _compact_words("e", 260),
        "shared_ground": [
            _compact_words("a", 100),
            _compact_words("b", 100),
            _compact_words("c", 100),
            _compact_words("d", 100),
        ],
        "key_considerations": [
            _compact_words("f", 60),
            _compact_words("g", 60),
            _compact_words("h", 60),
        ],
        "open_questions": [
            _compact_words("i", 30),
            _compact_words("j", 30),
        ],
        "recommended_next_step": _compact_words("n", 70),
    }


def _overlong_six_hundred_candidate() -> dict[str, object]:
    return {
        "title": "An overlong model draft",
        "executive_summary": _compact_words("s", 260),
        "shared_ground": [
            _compact_words("a", 70),
            _compact_words("b", 70),
            _compact_words("c", 70),
            _compact_words("d", 70),
        ],
        "key_considerations": [
            _compact_words("e", 50),
            _compact_words("f", 50),
            _compact_words("g", 50),
        ],
        "open_questions": [
            _compact_words("h", 25),
            _compact_words("i", 25),
        ],
        "recommended_next_step": _compact_words("n", 53),
    }


def test_create_read_and_creator_index(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    alice_address = contract.upgrade_authority.__class__(direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_GENERATE_V1", json.dumps(_candidate("first"))
    )

    contract.create_brief(
        "brief-2026-alpha", "Quarterly planning", _source(130), 200
    )

    result = contract.get_brief("brief-2026-alpha")
    assert result["schema"] == "consensusbrief/brief/v1"
    assert result["id"] == "brief-2026-alpha"
    assert result["creator"] == f"0x{bytes(direct_alice).hex()}"
    assert result["request_title"] == "Quarterly planning"
    assert result["source_word_count"] == 130
    assert result["brief"]["word_count"] == 165
    assert contract.brief_exists("brief-2026-alpha") is True
    assert contract.get_brief_count() == 1
    assert contract.get_brief_id(0) == "brief-2026-alpha"
    assert contract.get_creator_brief_count(alice_address) == 1
    assert contract.get_creator_brief_ids(alice_address, 0, 10) == [
        "brief-2026-alpha"
    ]


def test_revision_pass_enforces_word_bounds(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_GENERATE_V1", json.dumps(_short_candidate())
    )
    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_REVISE_V1", json.dumps(_candidate("revised"))
    )

    contract.create_brief("brief-revision-01", "", _source(125), 200)

    result = contract.get_brief("brief-revision-01")
    assert result["brief"]["title"] == "A grounded working brief"
    assert result["brief"]["word_count"] == 165


def test_expanded_source_and_output_limits(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_GENERATE_V1", json.dumps(_expanded_candidate())
    )

    contract.create_brief(
        "brief-expanded-1000", "Expanded analysis", _compact_source(5_000), 1000
    )

    result = contract.get_brief("brief-expanded-1000")
    assert result["source_word_count"] == 5_000
    assert result["target_words"] == 1000
    assert result["minimum_words"] == 800
    assert result["maximum_words"] == 1000
    assert result["brief"]["word_count"] == 970
    assert contract.get_config()["targets"] == [200, 400, 600, 1000]
    assert contract.get_config()["maximum_source_words"] == 5_000
    assert contract.get_config()["maximum_source_characters"] == 50_000

    with direct_vm.expect_revert("source_word_count_out_of_range"):
        contract.create_brief(
            "brief-source-too-long", "", _compact_source(5_001), 200
        )

    with direct_vm.expect_revert("source_too_short_for_target"):
        contract.create_brief(
            "brief-expanded-short", "", _compact_source(799), 1000
        )


def test_overlong_model_output_is_compacted_instead_of_reverting(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    overlong = json.dumps(_overlong_six_hundred_candidate())
    direct_vm.mock_llm("CONSENSUS_BRIEF_GENERATE_V1", overlong)
    direct_vm.mock_llm("CONSENSUS_BRIEF_REVISE_V1", overlong)

    contract.create_brief(
        "brief-overlong-600", "", _compact_source(300), 600
    )

    result = contract.get_brief("brief-overlong-600")
    assert result["brief"]["word_count"] == 600
    assert len(result["brief"]["shared_ground"]) == 4
    assert len(result["brief"]["key_considerations"]) == 3
    assert len(result["brief"]["open_questions"]) == 2


def test_rejects_invalid_inputs_and_duplicate(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("invalid_brief_id"):
        contract.create_brief("bad id", "", _source(130), 200)

    with direct_vm.expect_revert("source_word_count_out_of_range"):
        contract.create_brief("brief-too-short", "", _source(20), 200)

    with direct_vm.expect_revert("source_too_short_for_target"):
        contract.create_brief("brief-short-six", "", _source(100), 600)

    with direct_vm.expect_revert("unsupported_target_words"):
        contract.create_brief("brief-bad-target", "", _source(130), 300)

    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_GENERATE_V1", json.dumps(_candidate("duplicate"))
    )
    contract.create_brief("brief-duplicate", "", _source(130), 200)
    with direct_vm.expect_revert("brief_already_exists"):
        contract.create_brief("brief-duplicate", "", _source(130), 200)


def test_creator_indexes_are_separate(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy(CONTRACT)
    address_type = contract.upgrade_authority.__class__
    alice_address = address_type(direct_alice)
    bob_address = address_type(direct_bob)
    direct_vm.mock_llm(
        "CONSENSUS_BRIEF_GENERATE_V1", json.dumps(_candidate("indexed"))
    )

    direct_vm.sender = direct_alice
    contract.create_brief("brief-alice-001", "", _source(130), 200)

    direct_vm.sender = direct_bob
    contract.create_brief("brief-bob-00001", "", _source(130), 200)

    assert contract.get_creator_brief_count(alice_address) == 1
    assert contract.get_creator_brief_count(bob_address) == 1
    assert contract.get_creator_brief_ids(alice_address, 0, 10) == [
        "brief-alice-001"
    ]
    assert contract.get_creator_brief_ids(bob_address, 0, 10) == [
        "brief-bob-00001"
    ]
