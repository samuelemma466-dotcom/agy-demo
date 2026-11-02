pragma ComponentBehavior: Bound

import QtQuick
import Quickshell
import Quickshell.Wayland
import qs.Commons
import qs.Ui

Item {
  id: root

  property var shell: null
  property var entries: []

  readonly property var favoriteIds: ["chromium", "org.gnome.Nautilus", "foot", "localsend", "obsidian", "com.microsoft.VSCode", "omachy-control-center", "omachy-connect", "omachy-drop", "omachy-jarvis", "omachy-developer"]
  readonly property int iconSize: 42
  readonly property int slotWidth: 58
  readonly property int panelHeight: 82
  readonly property int sidePadding: 14
  readonly property int naturalWidth: entries.length * slotWidth + sidePadding * 2
  property int windowRevision: 0

  function cleanId(value) {
    var id = String(value || "").trim();
    if (id.slice(-8) === ".desktop")
      id = id.slice(0, -8);
    return id.toLowerCase();
  }

  function refreshEntries() {
    var applications = DesktopEntries.applications.values || [];
    var regular = [];
    var omachy = [];

    for (var i = 0; i < favoriteIds.length; i++) {
      var wanted = cleanId(favoriteIds[i]);
      for (var j = 0; j < applications.length; j++) {
        var entry = applications[j];
        if (cleanId(entry.id) !== wanted)
          continue;
        if (!entry.name || !entry.command || entry.noDisplay === true)
          continue;
        var item = {
          separator: false,
          entry: entry
        };
        if (wanted.indexOf("omachy-") === 0)
          omachy.push(item);
        else
          regular.push(item);
        break;
      }
    }

    // A divider appears only when one or more real Omachy desktop entries
    // were discovered. Missing project launchers never become dead buttons.
    if (omachy.length > 0)
      regular.push({
        separator: true
      });
    entries = regular.concat(omachy);
  }

  function matchingWindow(entry) {
    // ToplevelManager is Quickshell's Wayland window list. `startupClass` is
    // the desktop-entry field and `appId` is supplied by the live toplevel.
    root.windowRevision;
    var wantedId = cleanId(entry.id);
    var wantedClass = cleanId(entry.startupClass);
    var command = entry.command || [];
    var executable = command.length > 0 ? cleanId(String(command[0]).split("/").pop()) : "";
    var windows = ToplevelManager.toplevels.values || [];

    // Prefer the focused matching window. When none is focused, use the first
    // matching toplevel in Quickshell's stable model order.
    for (var i = 0; i < windows.length; i++) {
      var window = windows[i];
      var appId = cleanId(window.appId);
      if (isEntryWindow(appId, wantedId, wantedClass, executable) && window.activated)
        return window;
    }
    for (var j = 0; j < windows.length; j++) {
      var candidate = windows[j];
      var candidateId = cleanId(candidate.appId);
      if (isEntryWindow(candidateId, wantedId, wantedClass, executable))
        return candidate;
    }
    return null;
  }

  function isEntryWindow(appId, desktopId, startupClass, executable) {
    return appId === desktopId || (startupClass && appId === startupClass) || (executable && appId === executable);
  }

  function iconSource(entry) {
    var icon = String(entry.icon || "");
    if (icon.indexOf("file://") === 0 || icon.indexOf("image://") === 0)
      return icon;
    if (icon.charAt(0) === "/")
      return Util.fileUrl(icon);
    return Quickshell.iconPath(icon || "application-x-executable", true);
  }

  function activateEntry(entry) {
    var window = matchingWindow(entry);
    if (window) {
      window.activate();
      return;
    }

    // Only DesktopEntries values reach this function. Keep the launcher argv
    // fixed and let gtk-launch resolve the selected installed desktop file.
    var id = cleanId(entry.id);
    if (!id)
      return;
    Quickshell.execDetached(["uwsm-app", "--", "gtk-launch", id + ".desktop"]);
  }

  function statusText(entry) {
    var window = matchingWindow(entry);
    if (!window)
      return "Open " + entry.name;
    var detail = window.title || window.appId || "";
    return entry.name + " · " + (window.activated ? "Focused" : "Running") + (detail ? " — " + detail : "");
  }

  Connections {
    target: DesktopEntries
    function onApplicationsChanged() {
      root.refreshEntries();
    }
  }

  Connections {
    target: ToplevelManager.toplevels
    function onObjectInsertedPost() {
      root.windowRevision++;
    }
    function onObjectRemovedPost() {
      root.windowRevision++;
    }
  }

  Connections {
    target: ToplevelManager
    function onActiveToplevelChanged() {
      root.windowRevision++;
    }
  }

  Component.onCompleted: refreshEntries()

  Variants {
    model: Quickshell.screens

    delegate: Component {
      PanelWindow {
        id: dockWindow
        required property var modelData
        screen: modelData

        readonly property int safeWidth: Math.max(80, screen.width - 28)
        readonly property int dockWidth: Math.min(root.naturalWidth, safeWidth)
        readonly property bool compact: root.naturalWidth > safeWidth

        visible: root.entries.length > 0
        implicitWidth: dockWidth
        implicitHeight: root.panelHeight
        anchors {
          left: true
          bottom: true
        }
        margins {
          left: Math.max(14, Math.round((screen.width - width) / 2))
          bottom: 12
        }
        color: "transparent"
        aboveWindows: true
        focusable: false
        exclusionMode: ExclusionMode.Ignore
        WlrLayershell.namespace: "omachy-dock"
        WlrLayershell.layer: WlrLayer.Top

        Rectangle {
          anchors.left: dockSurface.left
          anchors.right: dockSurface.right
          anchors.top: dockSurface.top
          anchors.topMargin: 6
          height: dockSurface.height - 2
          radius: dockSurface.radius
          color: Qt.rgba(0, 0, 0, 0.22)
        }

        Rectangle {
          id: dockSurface
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.bottom: parent.bottom
          height: 70
          radius: 24
          color: Qt.rgba(Color.background.r, Color.background.g, Color.background.b, 0.88)
          border.width: 1
          border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.22)

          Rectangle {
            anchors.fill: parent
            anchors.margins: 1
            radius: 23
            color: "transparent"
            border.width: 1
            border.color: Qt.rgba(Color.accent.r, Color.accent.g, Color.accent.b, 0.08)
          }

          Row {
            anchors.centerIn: parent
            spacing: 2

            Repeater {
              model: root.entries

              delegate: Item {
                id: dockItem
                required property var modelData
                readonly property bool separator: modelData.separator === true
                readonly property var desktopEntry: modelData.entry || null
                readonly property var runningWindow: desktopEntry ? root.matchingWindow(desktopEntry) : null
                readonly property bool focused: runningWindow !== null && runningWindow.activated
                readonly property int actualIconSize: dockWindow.compact ? 32 : root.iconSize
                width: separator ? 13 : (dockWindow.compact ? Math.max(36, (dockWindow.safeWidth - root.sidePadding * 2) / root.entries.length) : root.slotWidth)
                height: 62
                property bool hovered: false
                readonly property real lift: hovered ? -5 : 0
                y: lift
                scale: hovered && !separator ? 1.08 : 1.0

                Behavior on y {
                  NumberAnimation {
                    duration: 145
                    easing.type: Easing.OutCubic
                  }
                }
                Behavior on scale {
                  NumberAnimation {
                    duration: 145
                    easing.type: Easing.OutCubic
                  }
                }

                Rectangle {
                  anchors.centerIn: parent
                  width: 1
                  height: 34
                  radius: 1
                  color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.18)
                  visible: dockItem.separator
                }

                Rectangle {
                  anchors.centerIn: parent
                  width: dockItem.actualIconSize + 3
                  height: dockItem.actualIconSize + 3
                  radius: 14
                  color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, dockItem.hovered ? 0.15 : 0.04)
                  border.width: 1
                  border.color: Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, dockItem.hovered ? 0.22 : 0.06)
                  visible: !dockItem.separator

                  Behavior on color {
                    ColorAnimation {
                      duration: 130
                      easing.type: Easing.OutCubic
                    }
                  }

                  Image {
                    anchors.fill: parent
                    anchors.margins: 5
                    source: dockItem.desktopEntry ? root.iconSource(dockItem.desktopEntry) : ""
                    sourceSize.width: 80
                    sourceSize.height: 80
                    fillMode: Image.PreserveAspectFit
                    smooth: true
                    asynchronous: true
                  }
                }

                Rectangle {
                  anchors.horizontalCenter: parent.horizontalCenter
                  anchors.bottom: parent.bottom
                  anchors.bottomMargin: 1
                  width: dockItem.focused ? 16 : (dockItem.runningWindow ? 11 : 4)
                  height: 4
                  radius: 2
                  color: dockItem.focused ? Color.accent : Qt.rgba(Color.foreground.r, Color.foreground.g, Color.foreground.b, 0.65)
                  opacity: dockItem.runningWindow ? 1 : 0
                  visible: !dockItem.separator

                  Behavior on width {
                    NumberAnimation {
                      duration: 130
                      easing.type: Easing.OutCubic
                    }
                  }
                  Behavior on opacity {
                    NumberAnimation {
                      duration: 130
                    }
                  }
                }

                MouseArea {
                  id: clickArea
                  anchors.fill: parent
                  hoverEnabled: true
                  cursorShape: Qt.PointingHandCursor
                  enabled: !dockItem.separator
                  onEntered: dockItem.hovered = true
                  onExited: dockItem.hovered = false
                  onClicked: if (dockItem.desktopEntry)
                    root.activateEntry(dockItem.desktopEntry)
                }

                PanelToolTip {
                  visible: clickArea.containsMouse && dockItem.desktopEntry !== null
                  text: dockItem.desktopEntry ? root.statusText(dockItem.desktopEntry) : ""
                  delay: 420
                }
              }
            }
          }
        }
      }
    }
  }
}
