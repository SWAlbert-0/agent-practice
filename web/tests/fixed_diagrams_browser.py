"""验证固定图表的自适应、可读下限、完整滚动范围和退出恢复。"""
import os
from pathlib import Path
from tempfile import gettempdir

from playwright.sync_api import sync_playwright, expect

url = os.getenv("WEB_TEST_URL", "http://127.0.0.1:5174")
output = Path(os.getenv("WEB_TEST_OUTPUT", str(Path(gettempdir()) / "agent-practice-web-tests")))
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1920,"height":1400})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.wait_for_load_state("networkidle")
    page.locator("#diagram-tab").click()
    page.locator("#diagram-type").select_option("时序图")
    expect(page.locator('svg[data-scene="main"]')).to_be_visible()
    original = page.locator("#diagram-stage").get_attribute("style")
    page.locator("#diagram-pin").click()
    expect(page.locator("#diagram-pin")).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#diagram-scale")).to_have_text("100%")
    assert page.locator("#diagram-viewport").evaluate(
        "e=>e.scrollWidth <= e.clientWidth+1 && e.scrollHeight <= e.clientHeight+1"
    )
    page.set_viewport_size({"width":780,"height":650})
    expect(page.locator("#diagram-scale")).to_have_text("90%")
    metrics = page.locator("#diagram-viewport").evaluate(
        "e=>({x:e.scrollWidth-e.clientWidth,y:e.scrollHeight-e.clientHeight})"
    )
    assert metrics["x"] > 0 and metrics["y"] > 0
    # 滚到底部右侧，仍能抵达完整 SVG 的末端，而不是被负坐标裁切。
    page.locator("#diagram-viewport").evaluate("e=>e.scrollTo(e.scrollWidth,e.scrollHeight)")
    assert page.locator("#diagram-viewport").evaluate(
        "e=>e.scrollLeft>0 && e.scrollTop>0"
    )
    bounds = page.locator("#diagram-viewport").evaluate('''e=>{
        const graph=e.querySelector('svg').getBoundingClientRect(),box=e.getBoundingClientRect();
        return {right:graph.right<=box.right+1,bottom:graph.bottom<=box.bottom+1};
    }''')
    assert bounds["right"] and bounds["bottom"], bounds
    page.locator("#diagram-viewport").evaluate("e=>e.scrollTo(0,0)")
    page.locator("#diagram-plus").click()
    expect(page.locator("#diagram-scale")).not_to_have_text("90%")
    while not page.locator("#diagram-minus").is_disabled():
        page.locator("#diagram-minus").click()
    expect(page.locator("#diagram-scale")).to_have_text("90%")
    page.locator("#diagram-sources button").first.click()
    expect(page.locator("#detail-dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator("#detail-dialog")).not_to_be_visible()
    expect(page.locator("#diagram-pin")).to_have_attribute("aria-pressed", "true")
    page.keyboard.press("Escape")
    expect(page.locator("#diagram-pin")).to_have_attribute("aria-pressed", "false")
    assert page.locator("#diagram-stage").get_attribute("style") == original
    page.locator("#diagram-type").select_option("流程图")
    page.locator("#diagram-scene").select_option("tool-loop")
    expect(page.locator('svg[data-scene="tool-loop"]')).to_be_visible()
    page.locator("#diagram-pin").click()
    page.set_viewport_size({"width":1440,"height":1000})
    expect(page.locator("#diagram-scale")).to_have_text("90%")
    page.screenshot(path=str(output / "fixed-diagram-desktop.png"), full_page=True)
    page.set_viewport_size({"width":390,"height":844})
    expect(page.locator("#diagram-pin")).to_be_visible()
    assert page.locator("#diagram-viewport").evaluate("e=>e.clientHeight>150")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert page.locator("#diagram-viewport").evaluate("e=>getComputedStyle(e).touchAction == 'pan-x pan-y'")
    assert page.locator("#diagram-viewport").evaluate('''e=>{
        const first=e.querySelector('.node').getBoundingClientRect(),view=e.getBoundingClientRect();
        return first.right>view.left && first.left<view.right;
    }''')
    page.screenshot(path=str(output / "fixed-diagram-mobile.png"), full_page=True)
    page.locator("#diagram-pin").click()
    expect(page.locator("body")).not_to_have_class("diagram-reading")
    assert not errors, errors
    browser.close()
    print("PASS: fixed viewport, complete diagram bounds, 90% minimum, resize, scrolling, source dialog, mobile, exit restore")
