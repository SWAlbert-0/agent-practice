"""用真实 Mermaid 渲染验证类型筛选、源码导航、缩放与小屏布局。"""
import json
import os
from pathlib import Path
from tempfile import gettempdir

from playwright.sync_api import sync_playwright, expect

url = os.getenv("WEB_TEST_URL", "http://127.0.0.1:5174")
output = Path(os.getenv("WEB_TEST_OUTPUT", str(Path(gettempdir()) / "agent-practice-web-tests")))
output.mkdir(parents=True, exist_ok=True)
scenes = json.loads((Path(__file__).resolve().parents[1] / "diagrams.json").read_text(encoding="utf-8"))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_load_state("networkidle")
    page.locator("#diagram-tab").click()
    expect(page.locator('#diagram-stage svg[data-scene="configuration"]')).to_be_visible()
    expect(page.locator("#diagram-type option")).to_have_count(3)
    expect(page.locator("#diagram-scene option")).to_have_count(15)
    page.locator("#diagram-type").select_option("时序图")
    expect(page.locator("#diagram-scene option")).to_have_count(5)
    expect(page.locator('#diagram-stage svg[data-scene="main"]')).to_be_visible()
    expect(page.locator("#diagram-count")).to_have_text("5 个图表")
    assert page.locator('svg[data-scene="main"]').evaluate(
        "e => [...e.querySelectorAll('.actor-line')].every(line => Number(line.getAttribute('y2')) <= e.viewBox.baseVal.y + e.viewBox.baseVal.height)"
    )
    page.screenshot(path=str(output / "sequence-desktop.png"), full_page=True)
    # 从时序图经源码弹窗跳往流程图，筛选必须同步切换。
    page.locator('#diagram-sources button[data-ref="1"]').click()
    expect(page.locator("#detail-dialog")).to_be_visible()
    page.locator('[data-diagram="configuration"]').click()
    expect(page.locator("#detail-dialog")).not_to_be_visible()
    expect(page.locator("#diagram-type")).to_have_value("流程图")
    expect(page.locator('#diagram-stage svg[data-scene="configuration"]')).to_be_visible()
    expect(page.locator("#diagram-scene option")).to_have_count(10)
    # 所有既有定义都必须能按新主题真实渲染。
    page.locator("#diagram-type").select_option("")
    for scene in scenes:
        page.locator("#diagram-scene").select_option(scene["id"])
        expect(page.locator(f'#diagram-stage svg[data-scene="{scene["id"]}"]')).to_be_visible()
        assert "加载失败" not in page.locator("#diagram-stage").inner_text()
        expect(page.locator("#diagram-title")).to_have_text(scene["title"])
    page.locator("#diagram-scene").select_option("tool-loop")
    expect(page.locator('#diagram-stage svg[data-scene="tool-loop"]')).to_be_visible()
    assert page.locator(".diagram-decision").count() > 0
    color = page.locator(".diagram-decision polygon").first.evaluate("e => getComputedStyle(e).fill")
    assert color == "rgb(255, 245, 229)", color
    page.locator("#diagram-fit").click()
    page.screenshot(path=str(output / "flowchart-desktop.png"), full_page=True)
    before = page.locator("#diagram-scale").inner_text()
    page.locator("#diagram-plus").click()
    assert page.locator("#diagram-scale").inner_text() != before
    page.locator("#diagram-scale").click()
    expect(page.locator("#diagram-scale")).to_have_text("100%")
    # 重绘后同一图的相机状态保持。
    page.locator("#diagram-minus").click()
    scale = page.locator("#diagram-scale").inner_text()
    page.locator("#diagram-scene").select_option("main")
    expect(page.locator('#diagram-stage svg[data-scene="main"]')).to_be_visible()
    page.locator("#diagram-scene").select_option("tool-loop")
    expect(page.locator('#diagram-stage svg[data-scene="tool-loop"]')).to_be_visible()
    expect(page.locator("#diagram-scale")).to_have_text(scale)
    # 小屏筛选和图表不撑宽页面；图内仍可缩放和平移。
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#diagram-type").select_option("时序图")
    expect(page.locator('#diagram-stage svg[data-scene="main"]')).to_be_visible()
    page.locator("#diagram-fit").click()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(output / "diagrams-mobile.png"), full_page=True)
    assert not errors, errors
    browser.close()
    print("PASS: dynamic type filters, 15 Mermaid renders, cross-type source navigation, zoom and mobile")
