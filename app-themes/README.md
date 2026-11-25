# App themes: Shelter v2 Sage in your other apps

Matching color themes so the editor, notes app and browser look like the Herdr layout.
They use the **Sage** palette from `themes/shelter_v2_sage.json` (calm sage green, text
about 10.6:1 on the background). Green and Amber have no app themes yet. Unofficial and
personal; AI Assisted. Contrast figures are WCAG ratios I calculated, not medical advice.

| Folder | App | Install |
|---|---|---|
| `vscode/` | VS Code | Copy the folder to `~/.vscode/extensions/local.shelter-v2-sage-theme-1.0.1`, restart, then Ctrl+K Ctrl+T > Shelter v2 Sage |
| `obsidian/` | Obsidian | Copy the folder to `<vault>/.obsidian/themes/Shelter v2 Sage/`, then Settings > Appearance > Themes. Optional: the Style Settings plugin exposes scanlines and glow (both calm by default) |
| `chrome/` | Chrome | `chrome://extensions`, turn on Developer mode, Load unpacked, pick the folder. A managed work profile may block this |
| `visual-studio/` | Visual Studio 2026 | Close Visual Studio, double-click `ShelterV2Sage.vsix`, then Tools > Theme > Shelter v2 Sage. Built against VS 18.x |

## Notes
- Obsidian bundles Share Tech Mono, IBM Plex Mono and VT323 inside `theme.css`; the SIL
  Open Font License texts sit beside it.
- The VS Code theme sets the terminal ANSI colors to the Herdr greens and keeps dim terminal
  text readable (4.7:1). Line numbers are 3.9:1.
- The Visual Studio theme recolors VS's stock Dark theme; it cannot set fonts. A color you
  changed in Tools > Options > Fonts and Colors overrides the theme until you reset it.
- These are built artifacts. The generators that made them read the author's local template
  themes, so they are not shipped; edit the JSON/CSS directly.
