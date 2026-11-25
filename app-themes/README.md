# App themes: Shelter v2 in your other apps

Matching color themes so the editor, notes app and browser look like the Herdr layout.
There is one per Herdr theme, in each app: **Green** (the original bright phosphor look),
**Sage** (calm, text about 10.6:1) and **Amber** (warm, text about 10.2:1). Palettes are the
ones in `themes/`. Unofficial and personal; AI Assisted. Contrast figures are WCAG ratios I
calculated, not medical advice.

| Folder | App | Install (replace `<v>` with `green`, `sage` or `amber`) |
|---|---|---|
| `vscode/<v>/` | VS Code | Copy the folder to `~/.vscode/extensions/local.shelter-v2-<v>-theme-1.0.0`, restart, then Ctrl+K Ctrl+T > Shelter v2 Green / Sage / Amber |
| `obsidian/<v>/` | Obsidian | Copy the folder to `<vault>/.obsidian/themes/Shelter v2 <V>/`, then Settings > Appearance > Themes. The Style Settings plugin exposes scanlines and glow |
| `chrome/<v>/` | Chrome | `chrome://extensions`, turn on Developer mode, Load unpacked, pick the folder. A managed work profile may block this |
| `visual-studio/` | Visual Studio 2026 | Close Visual Studio, double-click `ShelterV2Green.vsix`, `ShelterV2Sage.vsix` or `ShelterV2Amber.vsix`, then Tools > Theme. Built against VS 18.x |

## Notes
- Obsidian bundles Share Tech Mono, IBM Plex Mono and VT323 inside `theme.css`; the SIL
  Open Font License texts sit beside it. Green keeps the bright original look (glow and
  strong scanlines on); Sage and Amber default to calmer settings (glow off, scanlines 0.2).
- VS Code: terminal ANSI colors follow the Herdr themes and dim terminal text stays at
  4.7:1 or more. Line numbers are readable in all three (Sage 3.9:1, Amber 4.2:1).
- Visual Studio recolors VS's stock Dark theme and cannot set fonts. A color you changed in
  Tools > Options > Fonts and Colors overrides the theme until you reset it. Each theme has
  its own id, so all three install side by side.
- These are built artifacts. The generators read local template themes, so they are not
  shipped; edit the JSON/CSS directly.
- Not yet seen loaded in the apps by the author.
