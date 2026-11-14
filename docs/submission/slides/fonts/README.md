# Jost, the deck's typeface

The deck uses Jost, the app's typeface, under the SIL Open Font License ([`OFL.txt`](OFL.txt)).
These three files are static cuts (Regular, Medium, SemiBold, Latin characters) made from the
variable font the web app ships (`@fontsource-variable/jost`).

The PDF embeds them. PowerPoint does not: install the three files on the machine that shows
`TrueSouth-slides.pptx`, or PowerPoint substitutes another font and the lines may wrap
differently. To carry the fonts inside the .pptx, install them, then in PowerPoint use
File > Options > Save > "Embed fonts in the file" and save once.
