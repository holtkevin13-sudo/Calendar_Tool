#!/usr/bin/env bash
# Download two public-domain feast icons from Wikimedia Commons into assets/images.
# Run once from the project root:   bash tools/fetch-icons.sh
#
# Both works are by 15th-century painters, so the paintings are long out of
# copyright; Commons hosts the reproductions under PD-Art. Verify the licence on
# the file pages linked below before you publish — licences can change.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/images

# Transfiguration — icon c. 1403, State Tretyakov Gallery, Moscow.
# Long attributed to Theophanes the Greek; Commons now records the author as unknown.
# https://commons.wikimedia.org/wiki/File:Transfiguration_by_Feofan_Grek_from_Spaso-Preobrazhensky_Cathedral_in_Pereslavl-Zalessky_(15th_c,_Tretyakov_gallery).jpeg
curl -fL --retry 3 -A "DormitionFastCompanion/1.0 (personal parish use)" \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Transfiguration%20by%20Feofan%20Grek%20from%20Spaso-Preobrazhensky%20Cathedral%20in%20Pereslavl-Zalessky%20(15th%20c,%20Tretyakov%20gallery).jpeg?width=1000" \
  -o assets/images/transfiguration-icon.jpg

# Dormition — Andreas Ritzos (Cretan School, 1421–1492), Galleria Sabauda, Turin.
# https://commons.wikimedia.org/wiki/File:Dormition_of_Theotokos_Andreas_Ritzos.jpg
curl -fL --retry 3 -A "DormitionFastCompanion/1.0 (personal parish use)" \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Dormition%20of%20Theotokos%20Andreas%20Ritzos.jpg?width=1000" \
  -o assets/images/dormition-icon.jpg

echo "Downloaded:"
ls -lh assets/images
echo
echo "Next: open the app, go to Feasts, and use 'Add an icon' to load each file."
echo "Record the credit and licence when prompted so the attribution stays with the image."

# ---- Additional verified public-domain feast icons (all pre-1500 works) ----

# Annunciation — the Ustyug Annunciation, Novgorod, c. 1120-1130, Tretyakov Gallery.
# Commons page states PD: author's life +100 years, published before 1931.
# https://commons.wikimedia.org/wiki/File:Annunciation_ystuj.jpg
curl -fL --retry 3 -A "DormitionFastCompanion/1.0 (personal parish use)" \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Annunciation%20ystuj.jpg?width=1000" \
  -o assets/images/annunciation-icon.jpg

# Nativity of Christ — icon, 15th c., Annunciation Cathedral, Moscow Kremlin
# (attributed to Andrei Rublev). 15th-century work; PD-Art.
# https://commons.wikimedia.org/wiki/File:Nativity_(15th_c.,_Annunciation_Cathedral_in_Moscow).jpg
curl -fL --retry 3 -A "DormitionFastCompanion/1.0 (personal parish use)" \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Nativity%20(15th%20c.,%20Annunciation%20Cathedral%20in%20Moscow).jpg?width=1000" \
  -o assets/images/nativity-icon.jpg

# Nativity of the Theotokos — icon, Commons page states PD (PD-old-100-expired,
# published before 1931).
# https://commons.wikimedia.org/wiki/File:Nativity_of_Theotokos.jpg
curl -fL --retry 3 -A "DormitionFastCompanion/1.0 (personal parish use)" \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Nativity%20of%20Theotokos.jpg?width=1000" \
  -o assets/images/nativity-theotokos-icon.jpg

echo
echo "Five feast icons downloaded. Verify each licence on its Commons page before publishing;"
echo "PD-Art is a US-centric doctrine — confirm it applies where you are."
