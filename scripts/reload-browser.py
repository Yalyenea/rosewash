"""Reload Rosewash through macOS Accessibility, then optionally refresh one tab."""

import hashlib
import subprocess
import sys
import time
from pathlib import Path

import ApplicationServices as AX
import Quartz
from AppKit import NSWorkspace


SUPPORTED_BROWSERS = {
    "net.imput.helium": "Helium",
    "com.ardia.browser": "Ardia",
}


def applescript(browser, body, *arguments):
    # Compile against the selected browser's own scripting dictionary: Ardia
    # and Helium expose the same tab operations with different native types.
    source = f'on run argv\n tell application "{browser}"\n{body}\n end tell\nend run'
    result = subprocess.run(
        ["osascript", "-e", source, *arguments],
        capture_output=True, text=True, timeout=10, check=True,
    )
    return result.stdout.strip()


def attribute(element, name):
    code, value = AX.AXUIElementCopyAttributeValue(element, name, None)
    # Optional attributes and elements replaced during rendering are expected.
    if code in (AX.kAXErrorAttributeUnsupported, AX.kAXErrorNoValue, AX.kAXErrorInvalidUIElement):
        return None
    if code:
        raise RuntimeError(f"Accessibility could not read {name}: {code}")
    return value


def descendants(root):
    pending = [root]
    while pending:
        element = pending.pop()
        yield element
        pending.extend(attribute(element, "AXChildren") or [])


def page_area(application, url):
    pending = list(attribute(application, "AXWindows") or [])
    while pending:
        element = pending.pop()
        if attribute(element, "AXRole") == "AXWebArea":
            if str(attribute(element, "AXURL")) == url:
                return element
            continue  # Never walk unrelated pages or long feeds.
        pending.extend(attribute(element, "AXChildren") or [])


def named(root, role, text):
    label = "AXValue" if role == "AXStaticText" else "AXTitle"
    return next((element for element in descendants(root)
                 if attribute(element, "AXRole") == role and attribute(element, label) == text), None)


def wait_for(operation, message):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        result = operation()
        if result is not None:
            return result
        time.sleep(0.05)
    raise RuntimeError(message)


def main():
    if not AX.AXIsProcessTrusted():
        raise RuntimeError("Enable Accessibility for the terminal running this command.")
    workspace = NSWorkspace.sharedWorkspace()
    running = [app for app in workspace.runningApplications()
               if app.bundleIdentifier() in SUPPORTED_BROWSERS]
    if not running:
        raise RuntimeError("Open Ardia or Helium before reloading Rosewash.")
    frontmost = workspace.frontmostApplication()
    # Prefer the browser the user is using. If both are in the background,
    # selecting one implicitly could reload the wrong profile.
    app = next((app for app in running
                if app.processIdentifier() == frontmost.processIdentifier()), None)
    if app is None:
        if len(running) != 1:
            raise RuntimeError("Bring Ardia or Helium to the front, then retry.")
        app = running[0]
    browser = SUPPORTED_BROWSERS[app.bundleIdentifier()]
    refresh_url = sys.argv[1] if len(sys.argv) > 1 else ""
    if refresh_url and not refresh_url.startswith(("http://", "https://")):
        raise ValueError("Pass an HTTP or HTTPS test-page URL.")

    # Chromium derives an unpacked extension's ID from its absolute folder path.
    folder = Path(__file__).resolve().parent.parent.joinpath("dist").resolve(strict=True)
    digest = hashlib.sha256(str(folder).encode()).hexdigest()[:32]
    extension_id = "".join(chr(97 + int(digit, 16)) for digit in digest)
    details_url = f"chrome://extensions/?id={extension_id}"
    application = AX.AXUIElementCreateApplication(app.processIdentifier())
    # Ardia's sidebar may place a new tab inside a group; focus its identity
    # instead of assuming the new tab is last in the sidebar's index order.
    focus_admin = "focus adminTab" if browser == "Ardia" else "set active tab index of front window to count tabs of front window"
    admin_id = applescript(browser, f'''
    if (count windows) is 0 then error "Open a browser window first."
    set adminTab to make new tab at end of tabs of front window with properties {{URL:item 1 of argv}}
    {focus_admin}
    activate
    return id of adminTab
''', details_url)
    try:
        focus_state = {}

        def focused():
            active_id = applescript(browser, "get id of active tab of front window")
            # Query the target process directly at click time, using the same
            # Accessibility connection that locates the Reload button.
            frontmost = attribute(application, "AXFrontmost")
            focus_state.update(tab=active_id, frontmost=frontmost)
            return True if active_id == admin_id and frontmost else None

        # Native tab focus and app activation complete after AppleScript returns.
        # Wait for that transition, then recheck immediately before the click.
        try:
            wait_for(focused, f"{browser} did not focus the extension details tab.")
        except RuntimeError as error:
            raise RuntimeError(f"{error} Expected tab {admin_id} in PID {app.processIdentifier()}; got {focus_state}.") from error
        page = wait_for(lambda: page_area(application, details_url), "Extension details did not open.")
        button = wait_for(lambda: named(page, "AXButton", "Reload"),
                          "Rosewash's Reload button was not found. Check that dist/ is loaded.")
        # Chromium's WebUI can acknowledge AXPress without firing Reload.
        # Send a native click at the located button, using its current bounds.
        if not focused():
            raise RuntimeError(f"{browser} changed focus or tabs; retry the reload.")
        position_ok, position = AX.AXValueGetValue(attribute(button, "AXPosition"), AX.kAXValueCGPointType, None)
        size_ok, size = AX.AXValueGetValue(attribute(button, "AXSize"), AX.kAXValueCGSizeType, None)
        if not position_ok or not size_ok:
            raise RuntimeError("Could not read the Reload button's bounds.")
        center = (position.x + size.width / 2, position.y + size.height / 2)
        pointer = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
        for event_type in (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp):
            event = Quartz.CGEventCreateMouseEvent(None, event_type, center, Quartz.kCGMouseButtonLeft)
            Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
        # Reloading can replace the WebArea itself, invalidating its AX handle.
        def confirmation():
            current = page_area(application, details_url)
            return named(current, "AXStaticText", "Reloaded") if current is not None else None

        wait_for(confirmation,
                 f"{browser} did not confirm the extension reload.")
        event = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pointer, Quartz.kCGMouseButtonLeft)
        Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)
    finally:
        applescript(browser, '''
    repeat with browserWindow in windows
      set matches to tabs of browserWindow whose id is item 1 of argv
      if (count matches) > 0 then
        close item 1 of matches
        exit repeat
      end if
    end repeat
''', admin_id)
    if refresh_url:
        focus_test = "focus testTab" if browser == "Ardia" else "set active tab index of browserWindow to tabIndex"
        applescript(browser, f'''
    repeat with browserWindow in windows
      repeat with tabIndex from (count tabs of browserWindow) to 1 by -1
        set testTab to tab tabIndex of browserWindow
        if URL of testTab is item 1 of argv then
          reload testTab
          {focus_test}
          return
        end if
      end repeat
    end repeat
    error "Extension reloaded, but the requested test page is not open."
''', refresh_url)
    print(f"Reloaded Rosewash in {browser} ({extension_id})")
    if refresh_url:
        print(f"Refreshed {refresh_url}")


if __name__ == "__main__":
    started = time.monotonic()
    try:
        main()
        print(f"Completed in {time.monotonic() - started:.1f}s")
    except (RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(getattr(error, "stderr", None) or str(error), file=sys.stderr)
        sys.exit(1)
