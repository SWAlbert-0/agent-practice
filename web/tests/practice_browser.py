"""验证案例节点独立展示，以及结构图、源码弹窗和信息流之间的切换。"""
import os
from pathlib import Path
from tempfile import gettempdir

from playwright.sync_api import sync_playwright, expect

url=os.getenv('WEB_TEST_URL','http://127.0.0.1:5174')
output=Path(os.getenv('WEB_TEST_OUTPUT',str(Path(gettempdir())/'agent-practice-web-tests')))
output.mkdir(parents=True,exist_ok=True)

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(url)
    page.wait_for_load_state('networkidle')
    expect(page.locator('#practice-panel')).to_be_hidden()
    page.locator('[data-node="group-entry"]').click()
    members=page.locator('.component-members [data-file]')
    expect(members).to_have_count(1)
    assert members.first.get_attribute('data-file')=='main.py'
    page.locator('#close-detail').click()
    page.locator('#full-view').click()
    expect(page.locator('.graph-node')).to_have_count(27)
    expect(page.locator('[data-node="agent-test"]')).to_have_count(0)
    expect(page.locator('[data-node="react-test"]')).to_have_count(0)
    expect(page.locator('[data-node="calculator-test"]')).to_have_count(0)
    page.locator('#practice-tab').click()
    expect(page.locator('#practice-panel')).to_be_visible()
    expect(page.locator('#canvas')).to_be_hidden()
    expect(page.locator('.map-actions')).to_be_hidden()
    expect(page.locator('.practice-card')).to_have_count(3)
    page.screenshot(path=str(output/'practice-desktop.png'),full_page=True)
    for node,file in [('agent-test','examples/simple_agent_demo.py'),('react-test','tests/test_react_agent.py'),('calculator-test','examples/calculator_demo.py')]:
        page.locator(f'[data-practice="{node}"]').click()
        expect(page.locator('#detail-dialog')).to_be_visible()
        expect(page.locator('.reader-file>span')).to_have_text(file)
        page.locator('#close-detail').click()
    page.locator('[data-implementation="simple"]').first.click()
    expect(page.locator('#detail-title')).to_have_text('SimpleAgent.run')
    page.locator('#close-detail').click()
    page.locator('#flow-tab').click()
    page.locator('#flow-path').select_option('examples/simple_agent_demo.py::main')
    page.locator('#step').click()
    expect(page.locator('.flow-active')).to_have_count(1)
    page.locator('#current-code').click()
    expect(page.locator('.reader-file>span')).to_have_text('examples/simple_agent_demo.py')
    page.locator('#close-detail').click()
    page.locator('#practice-tab').click()
    expect(page.locator('#play')).to_have_text('▶ 播放')
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('#practice-tab')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(output/'practice-mobile.png'),full_page=True)
    page.locator('[data-practice="react-test"]').click()
    expect(page.locator('#detail-dialog')).to_be_visible()
    page.keyboard.press('Escape')
    page.locator('#structure-tab').click()
    expect(page.locator('.graph-node')).to_have_count(27)
    assert not errors,errors
    browser.close()
    print('PASS: structure excludes examples/tests, catalog source navigation, information flow, mobile')
