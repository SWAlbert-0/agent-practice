"""可选浏览器检查：需要 Playwright；预览服务由调用方启动。"""
import os
import json
from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright, expect

url = os.getenv("WEB_TEST_URL", "http://127.0.0.1:5174")
output = Path(os.getenv("WEB_TEST_OUTPUT", str(Path(gettempdir()) / "agent-practice-web-tests")))
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_load_state("networkidle")
    expect(page.locator("#sync-status")).to_have_text("源码引用已核对")
    expect(page.locator("#zoom-label")).to_have_text("100%")
    expect(page.locator(".graph-node")).to_have_count(6)
    expect(page.locator("#case-detail")).to_be_hidden()
    page.locator("#flow-tab").click()
    catalog = json.loads((Path(__file__).resolve().parents[1] / "examples.json").read_text(encoding="utf-8"))
    expect(page.locator("#flow-path option")).to_have_count(len(catalog))
    for entry in catalog:
        name = entry["id"]
        page.locator("#flow-path").select_option(name)
        count = page.locator("#case-steps button").count()
        assert count > 0
        for index in range(count):
            page.locator("#step").click()
            expect(page.locator("#step-counter")).to_have_text(f"{index + 1} / {count}")
            expect(page.locator(".flow-active")).to_have_count(1)
            expect(page.locator("#case-steps [aria-current=step]")).to_have_count(1)
            page.locator("#current-code").click()
            expect(page.locator("#detail-dialog")).to_be_visible()
            assert page.locator(".line-active").count() >= 1
            assert "负责什么" in page.locator(".reader-notes").inner_text()
            assert "接收什么" in page.locator(".reader-notes").inner_text()
            assert "返回什么" in page.locator(".reader-notes").inner_text()
            assert "调用谁" in page.locator(".reader-notes").inner_text()
            page.locator("#close-detail").click()
        expect(page.locator("#step")).to_be_disabled()
        page.locator("#previous").click()
        expect(page.locator("#step-counter")).to_have_text(f"{count - 1} / {count}")
        page.locator("#reset").click()
        expect(page.locator("#current-code")).to_be_disabled()
    calculator = "examples/calculator_demo.py::demo_calculator_tool"
    page.locator("#flow-path").select_option(calculator)
    expect(page.locator(".graph-node")).to_have_count(2)
    page.locator("#case-steps button").nth(1).click()
    page.screenshot(path=str(output / "calculator-desktop.png"), full_page=True)
    page.locator("#full-view").click()
    expect(page.locator(".graph-node")).to_have_count(7)
    ids = page.locator(".graph-node").evaluate_all("nodes => nodes.map(n => n.dataset.node)")
    assert not any("agents/" in node or "core/llm.py" in node for node in ids)
    expect(page.locator(".flow-active")).to_have_count(1)
    page.locator("#flow-path").select_option(catalog[0]["id"])
    count = page.locator("#case-steps button").count()
    page.locator("#speed").select_option("900")
    page.locator("#play").click()
    expect(page.locator("#step-counter")).to_have_text(f"1 / {count}")
    page.locator("#play").click()
    before = page.locator("#step-counter").inner_text()
    page.wait_for_timeout(1100)
    assert page.locator("#step-counter").inner_text() == before
    page.locator("#reset").click()
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#compact-view").click()
    page.locator("#flow-path").select_option(calculator)
    page.locator("#step").click()
    page.screenshot(path=str(output / "calculator-mobile.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#current-code").click()
    expect(page.locator("#detail-dialog")).to_be_visible()
    expect(page.locator(".line-active")).to_have_count(1)
    page.locator("#close-detail").click()
    page.locator("#structure-tab").click()
    expect(page.locator("#case-detail")).to_be_hidden()
    assert not errors, errors
    browser.close()
    print("PASS: complete cases, source anchors, navigation, playback, desktop and mobile")
