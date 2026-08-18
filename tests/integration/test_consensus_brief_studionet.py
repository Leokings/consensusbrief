"""Production ConsensusBrief smoke test against hosted StudioNet."""

from __future__ import annotations

import json
import os
from pathlib import Path
from time import monotonic
from typing import Any
from urllib.request import Request, urlopen

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = PROJECT_ROOT / "contracts" / "consensus_brief.py"
BRIEF_ID = "studionet-5000-20260818"
SOURCE_URL = "https://www.rfc-editor.org/rfc/rfc9110.txt"


def _expanded_source() -> str:
    request = Request(SOURCE_URL, headers={"User-Agent": "ConsensusBrief-Test/1.0"})
    with urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8", errors="replace")
    excerpt = " ".join(text.split()[:4_997])
    source = f"Source URL: {SOURCE_URL}\n\n{excerpt}"
    assert len(source.split()) == 5_000
    assert len(source) <= 50_000
    return source


def _receipt_hash(receipt: Any) -> str:
    if isinstance(receipt, dict):
        for key in ("transaction_hash", "tx_hash", "hash", "transactionHash"):
            value = receipt.get(key)
            if isinstance(value, str):
                return value
    for attribute in ("transaction_hash", "tx_hash", "hash"):
        value = getattr(receipt, attribute, None)
        if isinstance(value, str):
            return value
    return "unavailable"


def test_production_consensus_brief_on_studionet() -> None:
    factory = get_contract_factory(contract_file_path=CONTRACT_PATH)
    existing_address = os.environ.get("CONSENSUS_BRIEF_CONTRACT_ADDRESS", "").strip()

    if existing_address:
        contract_address = existing_address
        contract = factory.build_contract(contract_address)
        deployment_hash = os.environ.get(
            "CONSENSUS_BRIEF_DEPLOYMENT_HASH", "previously_deployed"
        )
        deployment_seconds = 0.0
    else:
        started = monotonic()
        deployment = factory.deploy_contract_tx(
            args=[], wait_transaction_status=TransactionStatus.FINALIZED
        )
        deployment_seconds = round(monotonic() - started, 2)
        assert tx_execution_succeeded(deployment), repr(deployment)
        contract_address = extract_contract_address(deployment)
        contract = factory.build_contract(contract_address)
        deployment_hash = _receipt_hash(deployment)

    print(
        "CONSENSUS_BRIEF_DEPLOYMENT "
        + json.dumps(
            {
                "contract_address": contract_address,
                "transaction_hash": deployment_hash,
                "seconds": deployment_seconds,
            },
            sort_keys=True,
        )
    )

    config = contract.get_config(args=[]).call()
    assert config["targets"] == [200, 400, 600, 1000]
    assert config["maximum_source_words"] == 5_000
    assert config["maximum_source_characters"] == 50_000

    source = _expanded_source()

    try:
        record = contract.get_brief(args=[BRIEF_ID]).call()
        creation_hash = "already_finalized"
        creation_seconds = 0.0
    except Exception:
        started = monotonic()
        receipt = contract.create_brief(
            args=[BRIEF_ID, "HTTP semantics consensus brief", source, 1000]
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        creation_seconds = round(monotonic() - started, 2)
        assert tx_execution_succeeded(receipt), repr(receipt)
        creation_hash = _receipt_hash(receipt)
        record = contract.get_brief(args=[BRIEF_ID]).call()

    word_count = record["brief"]["word_count"]
    assert record["schema"] == "consensusbrief/brief/v1"
    assert record["id"] == BRIEF_ID
    assert record["source_text"] == source
    assert record["source_word_count"] == 5_000
    assert record["target_words"] == 1000
    assert 800 <= word_count <= 1000
    assert contract.brief_exists(args=[BRIEF_ID]).call() is True
    assert contract.get_brief_count(args=[]).call() >= 1

    print(
        "CONSENSUS_BRIEF_RESULT "
        + json.dumps(
            {
                "brief_id": BRIEF_ID,
                "title": record["brief"]["title"],
                "word_count": word_count,
                "transaction_hash": creation_hash,
                "seconds": creation_seconds,
            },
            sort_keys=True,
        )
    )
