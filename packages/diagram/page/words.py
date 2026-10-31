# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Words shared by every diagram page and the index."""

OVERLAYS = """<p>The <strong>physics layer</strong> recolours whichever view is open: the 3D model, the exploded view, the cut, or a moment in time. Material values come from the materials library (packages/materials), copied with their sources by build/materials_export.py. Where the library holds no value the part is drawn as "no data", and no value is made up to fill it.</p>
<p><strong>Temperature.</strong> One temperature per part, from each diagram's own heat model, stated in its working. It keeps the number and drops every gradient inside a part.</p>
<p><strong>Thermal camera.</strong> What a long-wave camera reports. Its band is 8 to 14 um. Band radiance is emissivity times Planck's law integrated over that band (Simpson's rule, 240 steps, Planck from perceive), plus the room's radiance reflected by the rest: L = e B(T) + (1 - e) B(T_room), with T_room = 296 K. The camera's number is the black-body temperature with the same L. Emissivity for metals is derived from the library's DC conductivity through the Hagen-Rubens limit of its Drude module, for a polished bulk surface at 10 um; oxide and roughness raise real values a great deal. The library holds no long-wave emissivity for glass, plastic or ceramic, so those parts show no data; real glass is opaque at 8 to 14 um, so a real camera could not see a filament through a bulb at all. The colour ramp is a ramp: it codes a number, not a colour of light. Checked: the band integrator over all wavelengths returns sigma T^4 / pi to 0.2 percent, and the filament's Planck peak lands on Wien's b / T.</p>
<p><strong>Current density and heating.</strong> J = I / A, uniform across each conductor (no skin effect, no crowding at bends), and P = I^2 R. R is L / (sigma A) with the library's conductivity at room temperature where the library holds the metal (copper, tungsten), times the heat model's resistance rise where the part heats; otherwise the circuit's own resistance. The Drude relation sigma = n e^2 tau / m links the library's conductivity to its electron density and collision time. Checked: on a stepped copper conductor, P summed slice by slice from the cutting plane's exact areas equals I^2 R from the closed form.</p>
<p><strong>Queued, not built in this pass.</strong> Fluid and gas flow (the cesium beam as a jet in vacuum, by advect-diffuse); stress birefringence and the photoelastic view, which needs a stress-optic coefficient the materials library does not hold; electric and magnetic field lines through the perceive bridges. Each needs its own known-answer test before it ships.</p>"""

INDEX = """<header class="k-head"><p class="k-super" aria-hidden="true">4D</p>
 <h1>Living diagrams</h1>
 <p class="k-lede">Seven HP instrument ideas, each one model seen every way at once: a schematic, a 3D model you can take apart and cut open, a version that runs in time, and a spacetime view with time as a fourth axis.</p>
 <hr class="k-horizon">
</header>
<section class="k-layer" data-layer="toy" id="toy" aria-labelledby="toy-h">
<div class="k-layer-head"><h2 id="toy-h">Take all seven apart</h2><span class="k-depth">toy</span></div>
<div class="k-controls dg-bar"><fieldset><legend>All models</legend><label for="all-explode">Tear down</label><input id="all-explode" type="range" min="0" max="100" step="1" value="35">
<label for="all-cut">Cut through</label><input id="all-cut" type="range" min="0" max="100" step="1" value="55"></fieldset></div>
<ol class="dg-cards">{{CARDS}}</ol>
</section>
<p class="k-message">One model per instrument; every view is drawn from it, says what its lens keeps and drops, and lights up the part you pick in all the others.</p>
<section class="k-layer" data-layer="plain" id="plain" aria-labelledby="plain-h">
<div class="k-layer-head"><h2 id="plain-h">In plain words</h2><span class="k-depth">plain</span></div>
<div class="prose">
<p>A drawing of a machine always leaves something out. A circuit diagram shows what connects to what and hides where things sit. A photograph shows the outside and hides the inside. A graph shows one number changing and hides the machine. These pages keep one model of each instrument and draw it all of those ways at once, so you can move between them.</p>
<p>Pick a part anywhere and it lights up everywhere. Drag the tear-down slider and the parts move apart along the lines they were assembled on. Drag the cutting plane and the model opens; the faces the plane cuts are hatched, as on an engineering drawing. Press play and the physics runs. The spacetime view lays the whole run out at once, with time as a direction you can turn into view.</p>
</div>
</section>
<section class="k-layer" data-layer="pro" id="pro" aria-labelledby="pro-h">
<div class="k-layer-head"><h2 id="pro-h">The working</h2><span class="k-depth">pro</span></div>
<div class="prose">
<p>The engine (packages/diagram) is dependency-free JavaScript. A model is a list of parts. Each part has geometry built from boxes, cylinders, tubes, cones, spheres, shells, surfaces of revolution and extrusions of any simple polygon, plus a material, a label, a text alternative, what it does, the quantity it carries and an assembly axis. Links join parts. The model is refused if any part lacks a label or a text alternative.</p>
<p>Every view reads one draw list. WebGL2 draws it when the browser has it, and a software z-buffer draws the same list otherwise; the same z-buffer picks parts, measures the lenses and makes the frames whose bytes the determinism test hashes. Cut faces come from chaining the plane's crossings of each closed mesh into loops, wound so that cavities subtract; the GPU fills them through the stencil buffer, even-odd. Poses sit on a 2^-16 grid, so the exploded pose minus its offset is the assembled pose exactly.</p>
<p>The spacetime view uses ndim: rotations in any of the six planes of 4D, perspective or orthographic projection with ndim's lens statements, and the slice t = t0 through the world-line edges. Lens losses follow perceive's loss rule, H(X | Y) on seeded surface samples coded to 1/24 of the model's radius.</p>
<p>Engine tests: {{TESTS}}</p>
</div>
""" + OVERLAYS + """
</section>"""
