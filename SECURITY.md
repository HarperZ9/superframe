# Security Policy

## Supported versions

`HarperZ9/superframe` ships as an open-source `MIT` rendering, simulation, audio, and study
engine. Security fixes ship in the current release line on `main`. Older releases do not receive
backports.

| Version | Supported |
|-|-|
| 0.3.x | Yes |
| < 0.3 | No |

## Reporting a vulnerability

Report suspected vulnerabilities privately through GitHub: open this repository's **Security** tab
and select **Report a vulnerability**, or open
<https://github.com/HarperZ9/superframe/security/advisories/new>.
Keep security reports out of public issues, pull requests, and discussions.

Include:

- the affected commit or release version and operating system,
- a concise description of the issue and its impact,
- the minimal scene, asset, or command input needed to reproduce it.

The maintainer, Zain Dana Harper, acknowledges reports and works on a fix before public
disclosure. Allow a reasonable period to remediate before disclosing.

## Scope and trust model

Superframe renders scenes, runs physical and biomechanical simulations, processes audio and font
assets, and executes local Node.js, Python, C++23, and BuildLang test suites.

- **Local-first execution, zero telemetry.** Core rendering, simulation, and study tools run
  locally without background network access or telemetry uploads.
- **Untrusted scenes and media assets.** Scene descriptions, shaders, font files, audio clips, and
  archive inputs may originate from third parties and must be parsed with bounded allocations.
- **Native and GPU backends.** Native DX12, Vulkan, and WebGPU paths trust the host OS graphics
  driver stack; driver bugs outside Superframe's control are reported upstream.
- **What counts as a vulnerability.** Arbitrary code or command execution triggered by untrusted
  scene, font, shader, or archive inputs; path traversal writing outside explicitly requested
  output directories; or memory-safety bugs in native C++23 modules reachable from untrusted data.
- **What does not count.** Visual differences across GPU vendors, driver crashes caused by host
  hardware instability, or malformed inputs rejected cleanly with an error.

## Good practice

- Inspect third-party scene scripts and shaders before running them with local filesystem access.
- Keep optional external API credentials in environment variables and out of committed scene or
  archive files.
