import json
import stat
import sys
import textwrap
from decimal import Decimal

from app import db, runner
from app.models import ActionApproval, AgentRun, LLMTokenRecord


def _is_verifier(prompt: str) -> bool:
    return prompt.startswith("You are the verifier")


def test_code_agent_proposal_waits_for_approval_then_executes(client):
    run_id = client.post("/agents/run", json={"agent": "CodeGenerationAgent", "instruction": "Fix checkout crash on empty cart"}).json()["run_id"]

    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "APPROVAL_REQUIRED"
    assert run["action_type"] == "CREATE_PR"
    assert run["verification"]["approved"] is True

    pending = client.get("/approvals/pending").json()
    assert [p["action_type"] for p in pending] == ["CREATE_PR"]

    resolved = client.post(f"/approvals/{pending[0]['id']}/resolve", json={"decision": "APPROVE"}).json()
    assert resolved["status"] == "EXECUTED"
    assert resolved["result"]["status"] == "simulated"
    assert client.get(f"/runs/{run_id}").json()["status"] == "EXECUTED"

    # A second click must not execute the action again.
    again = client.post(f"/approvals/{pending[0]['id']}/resolve", json={"decision": "APPROVE"})
    assert again.status_code == 409


def test_rejecting_an_approval_marks_the_run(client):
    run_id = client.post("/agents/run", json={"agent": "SocialMediaAgent", "instruction": "Announce the v2 API"}).json()["run_id"]
    approval_id = client.get("/approvals/pending").json()[0]["id"]
    assert client.post(f"/approvals/{approval_id}/resolve", json={"decision": "REJECT"}).json()["status"] == "REJECTED"
    assert client.get(f"/runs/{run_id}").json()["status"] == "REJECTED"


def test_unknown_agent_is_404(client):
    assert client.post("/agents/run", json={"agent": "Nope", "instruction": "anything"}).status_code == 404


def test_verifier_rejection_gets_one_retry(client, script_model):
    calls = {"verify": 0}

    def model(prompt, agent):
        if _is_verifier(prompt):
            calls["verify"] += 1
            return {"approved": calls["verify"] > 1, "feedback": "Too vague."}
        assert calls["verify"] == 0 or "rejected by the verifier" in prompt
        return None  # fall back to the agent's simulated proposal

    script_model(model)
    run_id = client.post("/agents/run", json={"agent": "CodeGenerationAgent", "instruction": "Fix login"}).json()["run_id"]
    assert calls["verify"] == 2
    assert client.get(f"/runs/{run_id}").json()["status"] == "APPROVAL_REQUIRED"


def test_two_verifier_rejections_drop_the_action(client, script_model):
    script_model(lambda prompt, agent: {"approved": False, "feedback": "Invents a metric."} if _is_verifier(prompt) else None)
    run_id = client.post("/agents/run", json={"agent": "SocialMediaAgent", "instruction": "Post revenue numbers"}).json()["run_id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "REJECTED"
    assert "Invents a metric" in run["error"]
    assert client.get("/approvals/pending").json() == []


def test_agent_cannot_use_actions_outside_its_allow_list(client, script_model):
    rogue = {
        "thought": "x",
        "action_type": "SEND_EMAIL",
        "payload": {"to_email": "a@b.co", "subject": "Hello there", "body": "A body that is long enough."},
        "summary": "x",
    }
    script_model(lambda prompt, agent: rogue if not _is_verifier(prompt) else {"approved": True, "feedback": ""})
    run_id = client.post("/agents/run", json={"agent": "FinanceAgent", "instruction": "Audit"}).json()["run_id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "REJECTED"
    assert "not an allowed action" in run["error"]
    assert client.get("/approvals/pending").json() == []


def test_invalid_payload_is_rejected_before_the_verifier(client, script_model):
    seen_verifier = []

    def model(prompt, agent):
        if _is_verifier(prompt):
            seen_verifier.append(prompt)
            return {"approved": True, "feedback": ""}
        return {"thought": "x", "action_type": "CREATE_PR", "payload": {"repo": "not a repo", "title": "t"}, "summary": "x"}

    script_model(model)
    run_id = client.post("/agents/run", json={"agent": "CodeGenerationAgent", "instruction": "Fix it"}).json()["run_id"]
    assert client.get(f"/runs/{run_id}").json()["status"] == "REJECTED"
    assert seen_verifier == []


def test_budget_cap_blocks_runs(client, configure):
    configure(DAILY_AGENT_BUDGET_USD=1.0)
    with db.session_scope() as s:
        s.add(LLMTokenRecord(agent="FinanceAgent", model="claude-opus-5", cost_usd=Decimal("1.50")))
    run_id = client.post("/agents/run", json={"agent": "FinanceAgent", "instruction": "Audit"}).json()["run_id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "BLOCKED"
    assert "cap is $1.00" in run["error"]
    # Other agents are unaffected by one agent's cap.
    other = client.post("/agents/run", json={"agent": "SocialMediaAgent", "instruction": "Ship log"}).json()["run_id"]
    assert client.get(f"/runs/{other}").json()["status"] == "APPROVAL_REQUIRED"


def test_spend_report(client):
    client.post("/agents/run", json={"agent": "FinanceAgent", "instruction": "Audit"})
    report = client.get("/spend").json()
    assert report["agents"][0]["agent"] == "FinanceAgent"
    assert report["agents"][0]["calls"] == 1  # NONE actions skip the verifier call


def test_claude_code_mode_parses_cli_output_and_attributes_cost(tmp_path, configure):
    fake = tmp_path / "claude"
    fake.write_text(
        textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json, sys
            args = sys.argv[1:]
            assert args[0] == "-p" and "--output-format" in args and "json" in args
            assert "--tools" in args  # no tools requested -> tools disabled, never bypassPermissions
            print(json.dumps({{
                "type": "result", "is_error": False,
                "result": "Here you go:\\n```json\\n{{\\"thought\\": \\"t\\", \\"action_type\\": \\"NONE\\", \\"payload\\": {{}}, \\"summary\\": \\"ok\\"}}\\n```",
                "total_cost_usd": 0.0123,
                "usage": {{"input_tokens": 1000, "output_tokens": 200}}
            }}))
            """
        )
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    configure(LLM_MODE="claude_code", CLAUDE_BIN=str(fake), WORK_DIR=tmp_path / "ws")

    from app.agents import get_agent

    run = get_agent("FinanceAgent").run("Audit revenue")
    assert run["status"] == "COMPLETED"
    assert run["summary"] == "ok"
    assert run["cost_usd"] == 0.0123
    with db.session_scope() as s:
        record = s.query(LLMTokenRecord).one()
        assert (record.input_tokens, record.output_tokens, record.simulated) == (1000, 200, False)


def test_claude_code_failure_marks_run_failed(tmp_path, configure):
    fake = tmp_path / "claude"
    fake.write_text(f"#!{sys.executable}\nimport json\nprint(json.dumps({{'is_error': True, 'result': 'overloaded'}}))\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    configure(LLM_MODE="claude_code", CLAUDE_BIN=str(fake), WORK_DIR=tmp_path / "ws")

    from app.agents import get_agent

    run = get_agent("FinanceAgent").run("Audit")
    assert run["status"] == "FAILED"
    assert "overloaded" in run["error"]


def test_parse_json_object_handles_fences_and_prose():
    assert runner.parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert runner.parse_json_object('Sure! {"a": {"b": 2}} Hope that helps.') == {"a": {"b": 2}}


def test_orchestrator_only_delegates_to_real_agents(client, script_model):
    plan = {
        "okr_focus": "Fix reliability",
        "summary": "s",
        "delegated_tasks": [
            {"agent": "FinanceAgent", "instruction": "Audit"},
            {"agent": "HiringAgent", "instruction": "Hire a VP"},
        ],
    }
    script_model(lambda prompt, agent: plan if agent == "MasterOrchestrator" else None)
    result = client.post("/orchestrator/run").json()
    assert len(result["run_ids"]) == 1
    briefing = client.get("/orchestrator/briefing").json()
    assert briefing["okr_focus"] == "Fix reliability"
    assert [t["agent"] for t in briefing["delegated_tasks"]] == ["FinanceAgent"]
    with db.session_scope() as s:
        assert s.query(AgentRun).filter_by(trigger="orchestrator").count() == 1


def test_operator_token_is_enforced(client, configure):
    configure(OPERATOR_TOKEN="s3cret")
    assert client.get("/runs").status_code == 401
    assert client.get("/runs", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/runs", headers={"Authorization": "Bearer s3cret"}).status_code == 200
    assert client.get("/health").status_code == 200


def test_live_feed_streams_run_events(client):
    with client.websocket_connect("/ws/live") as ws:
        assert ws.receive_json()["event"] == "CONNECTED"
        client.post("/agents/run", json={"agent": "FinanceAgent", "instruction": "Audit"})
        seen = [json.loads(ws.receive_text())["event"] for _ in range(3)]
    assert seen == ["TASK_QUEUED", "TASK_START", "TASK_COMPLETE"]


def test_resolving_an_approval_pushes_the_updated_run(client):
    run_id = client.post("/agents/run", json={"agent": "SocialMediaAgent", "instruction": "Ship log"}).json()["run_id"]
    approval_id = client.get("/approvals/pending").json()[0]["id"]
    with client.websocket_connect("/ws/live") as ws:
        ws.receive_json()  # CONNECTED
        client.post(f"/approvals/{approval_id}/resolve", json={"decision": "APPROVE"})
        event = json.loads(ws.receive_text())
    assert event["event"] == "APPROVAL_RESOLVED"
    assert event["run"]["id"] == run_id and event["run"]["status"] == "EXECUTED"


def test_approval_rows_store_validated_payloads(client):
    client.post("/agents/run", json={"agent": "CodeGenerationAgent", "instruction": "Fix it"})
    with db.session_scope() as s:
        approval = s.query(ActionApproval).one()
        assert approval.payload["base_branch"] == "main"  # defaults filled by the schema
