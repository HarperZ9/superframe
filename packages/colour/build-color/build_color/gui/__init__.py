"""
Build Color - GUI Package

Launch the application with build_color.gui.launch()
"""


def launch():
    import logging
    import sys

    from PyQt6.QtWidgets import QApplication

    from build_color.gui.app import BuildColorWindow

    logger = logging.getLogger(__name__)

    # Windows taskbar icon fix
    try:
        import ctypes

        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("build.buildcolor.1")
    except Exception as exc:
        logger.debug("Skipping Windows AppUserModelID registration: %s", exc)

    app = QApplication(sys.argv)
    app.setApplicationName("Build Color")
    app.setOrganizationName("Build Universe")

    window = BuildColorWindow()
    window.show()
    return app.exec()
