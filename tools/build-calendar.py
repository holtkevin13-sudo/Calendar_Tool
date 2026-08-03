#!/usr/bin/env python3
"""
build-calendar.py — turn the GOARCH Planner ICS into the app's calendar JSON.

Usage:
    python3 tools/build-calendar.py "Planner 2026-2027/planner2026-en.ics" data/calendar-year.json

The Planner is published by the Greek Orthodox Archdiocese of America at
https://www.goarch.org/chapel/planner and is the controlling source for every
fasting designation this app displays.

By default only the READING CITATIONS are extracted, not the scripture text.
The Planner embeds a full copyrighted English translation; citations are facts,
the translation is not ours to redistribute on a public web page. Pass
--with-readings if you are building a copy for your own device only.
"""
import argparse
import datetime
import json
import re
import sys

# The five designations the Planner uses, mapped to this app's internal ids.
FAST_MAP = {
    "Strict Fast": "strict",
    "Fast Day (Wine and Oil Allowed)": "wine-oil",
    "Fast Day (Fish Allowed)": "fish-oil-wine",
    "Fast Day (Dairy, Eggs, and Fish Allowed)": "dairy",
    "Fast Free": "fast-free",
}
# A day with no designation line is an ordinary day: the Online Chapel shows
# "No fasting restrictions." That is not the same as the explicit "Fast Free"
# designation, which marks the fast-free weeks, so it gets its own id.
NO_DESIGNATION = "none"


def unescape(s):
    return (s.replace("\\n", "\n").replace("\\,", ",")
             .replace("\\;", ";").replace("\\\\", "\\"))


def unfold(text):
    return text.replace("\r\n", "\n").replace("\n ", "").replace("\n\t", "")


def parse(path, with_readings=False):
    raw = unfold(open(path, encoding="utf-8").read())
    events = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.S)
    days = []
    for ev in events:
        m = re.search(r"DTSTART;VALUE=DATE:(\d{8})", ev)
        if not m:
            continue
        ymd = m.group(1)
        iso = f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"
        summary = unescape(re.search(r"SUMMARY:(.*)", ev).group(1)).strip()
        dm = re.search(r"DESCRIPTION:(.*)", ev)
        desc = unescape(dm.group(1)) if dm else ""

        blocks = [b.strip() for b in desc.split("\n\n")]

        level = NO_DESIGNATION
        label = None
        for b in blocks:
            if b in FAST_MAP:
                level, label = FAST_MAP[b], b
                break

        saints = []
        for b in blocks:
            if b.startswith("Saints and Feasts:"):
                saints = [s.strip() for s in b.split(":", 1)[1].split(";") if s.strip()]
                break

        readings = []
        for kind in ("Matins Gospel Reading", "Epistle Reading", "Gospel Reading"):
            rm = re.search(re.escape(kind) + r": ([^\n]+)", desc)
            if not rm:
                continue
            entry = {"label": kind.replace(" Reading", ""), "citation": rm.group(1).strip()}
            if with_readings:
                after = desc.split(rm.group(0), 1)[1]
                entry["text"] = after.split("\n\n")[0].strip()
            readings.append(entry)

        days.append({
            "date": iso,
            "title": summary,
            "fastingLevel": level,
            "fastingLabel": label,
            "saints": saints,
            "readings": readings,
        })

    days.sort(key=lambda d: d["date"])
    for d in days:
        classify(d)
    return days


# The Twelve Great Feasts, plus Pascha which stands above them. Matched on the
# Planner's own title wording, anchored so that a Forefeast or Afterfeast of the
# same feast is never mistaken for the feast itself.
GREAT_FEASTS = [
    ("Nativity of the Theotokos",      r"^The Nativity of Our Most Holy Lady"),
    ("Elevation of the Holy Cross",    r"^The Elevation of the Venerable"),
    ("Entrance of the Theotokos",      r"^The Entrance of the Theotokos"),
    ("Nativity of Christ",             r"^The Nativity of Our Lord"),
    ("Theophany",                      r"^The Theophany of Our Lord"),
    ("Presentation of Our Lord",       r"^The Presentation of Our Lord"),
    ("Annunciation",                   r"^Annunciation of the Theotokos"),
    ("Palm Sunday",                    r"^Palm Sunday"),
    ("Pascha",                         r"^Great and Holy Pascha"),
    ("Ascension",                      r"^Holy Ascension"),
    ("Pentecost",                      r"^Holy Pentecost"),
    ("Transfiguration",                r"^Transfiguration of our Lord"),
    ("Dormition of the Theotokos",     r"^The Dormition of our Most Holy Lady"),
]


def classify(day):
    """Tag each day with a rank so the app can index and decorate it correctly."""
    t = day["title"]
    for name, pattern in GREAT_FEASTS:
        if re.search(pattern, t, re.I):
            day["greatFeast"] = name
            day["rank"] = "pascha" if name == "Pascha" else "great-feast"
            return day
    lowered = t.lower()
    if lowered.startswith("forefeast") or lowered.startswith("eve of the"):
        day["rank"] = "forefeast"
    elif lowered.startswith("afterfeast"):
        day["rank"] = "afterfeast"
    elif lowered.startswith("apodosis") or lowered.startswith("leavetaking"):
        day["rank"] = "apodosis"
    elif "sunday" in lowered:
        day["rank"] = "sunday"
    else:
        day["rank"] = "ordinary"
    return day


def tag_cycles(days):
    """Tag each day with its place in the movable (paschal) cycle.

    Every anchor is a Planner title, never a computed date:
      Triodion  : "Triodion Begins Today" .. day before Clean Monday
      Great Lent: day after "Forgiveness Sunday" .. day before "Lazarus Saturday"
      Holy Week : "Holy Monday" .. "Holy Saturday"
      Bright    : "Great and Holy Pascha" .. day before "Thomas Sunday"
      Pentecostarion (rest): Thomas Sunday .. "The Sunday of All Saints"
    Days carrying a cycle tag are the movable calendar; everything else is fixed.
    """
    idx = {d["date"]: i for i, d in enumerate(days)}

    def first(pattern):
        for d in days:
            if re.search(pattern, d["title"], re.I):
                return d["date"]
        return None

    a_triodion = first(r"Triodion Begins")
    a_forgive  = first(r"^Forgiveness Sunday")
    a_lazarus  = first(r"^Lazarus Saturday")
    a_holymon  = first(r"^Holy Monday")
    a_pascha   = first(r"^Great and Holy Pascha")
    a_thomas   = first(r"^Thomas Sunday")
    a_allsts   = first(r"Sunday of All Saints")

    def span(tag, start, end_exclusive=None, end_inclusive=None):
        if not start:
            return
        i = idx[start]
        stop = idx[end_exclusive] if end_exclusive else (idx[end_inclusive] + 1 if end_inclusive else i + 1)
        for j in range(i, stop):
            days[j]["cycle"] = tag

    if a_triodion and a_forgive:
        span("triodion", a_triodion, end_inclusive=a_forgive)
    if a_forgive and a_lazarus:
        clean_monday = days[idx[a_forgive] + 1]["date"]
        span("great-lent", clean_monday, end_exclusive=a_lazarus)
    if a_lazarus and a_holymon:
        span("great-lent", a_lazarus, end_exclusive=a_holymon)  # Lazarus Sat + Palm Sunday bridge
    if a_holymon and a_pascha:
        span("holy-week", a_holymon, end_exclusive=a_pascha)
    if a_pascha and a_thomas:
        span("bright-week", a_pascha, end_exclusive=a_thomas)
    if a_thomas and a_allsts:
        span("pentecostarion", a_thomas, end_inclusive=a_allsts)

    milestones = []
    for d in days:
        if not d.get("cycle"):
            continue
        r = d.get("rank")
        t = d["title"]
        if (r in ("sunday", "great-feast", "pascha")
                or re.search(r"^(Clean Monday|Lazarus Saturday|Holy (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday))|Saturday of Souls|Cheesefare Saturday|Saturday of Lent|Renewal Saturday|Akathist", t, re.I)):
            milestones.append({"date": d["date"], "title": t, "cycle": d["cycle"],
                               "fastingLevel": d["fastingLevel"]})
    return milestones


def find_seasons(days):
    """Group consecutive fasting days into named seasons using the known anchors."""
    by = {d["date"]: d for d in days}
    seasons = []
    run = []
    for d in days:
        fasting = d["fastingLevel"] in ("strict", "wine-oil", "fish-oil-wine")
        if fasting:
            run.append(d)
        else:
            if len(run) >= 7:
                seasons.append((run[0]["date"], run[-1]["date"], len(run)))
            run = []
    if len(run) >= 7:
        seasons.append((run[0]["date"], run[-1]["date"], len(run)))

    def covers(start, end, mm, dd):
        """Does this run contain the given month/day anchor?"""
        y0, y1 = int(start[:4]), int(end[:4])
        for y in range(y0, y1 + 1):
            probe = f"{y:04d}-{mm:02d}-{dd:02d}"
            if start <= probe <= end:
                return True
        return False

    named = []
    for start, end, n in seasons:
        if covers(start, end, 12, 20):
            name = "The Nativity Fast"
            blurb = "Forty days of preparation for the Nativity of Christ, November 15 to December 24."
        elif covers(start, end, 8, 10):
            name = "The Dormition Fast"
            blurb = "Two weeks of preparation for the Dormition of the Theotokos, August 1 to 14."
        elif covers(start, end, 6, 28) or (covers(start, end, 6, 20) and n < 45):
            name = "The Apostles' Fast"
            blurb = "A fast of variable length, ending on June 28, the eve of the feast of Saints Peter and Paul."
        elif n > 40:
            name = "Great Lent and Holy Week"
            blurb = "The Great Fast, beginning on Clean Monday and running through Holy Saturday."
        else:
            name, blurb = "A fasting period", ""
        # The run can start a day or two early because the preceding Wednesday or
        # Friday is itself a fast day; note the observed run honestly.
        named.append({"name": name, "start": start, "end": end, "days": n, "blurb": blurb})
    return named


def wedfri_exceptions(days):
    """Wednesdays and Fridays that carry NO fasting designation — the exceptions
    the fast-free weeks create. The rule itself (Wed/Fri are fast days) is shown
    in the app as explanation; this lists this year's actual exceptions."""
    out = []
    for d in days:
        dt = datetime.date.fromisoformat(d["date"])
        if dt.weekday() in (2, 4) and d["fastingLevel"] in ("none", "fast-free"):
            out.append({"date": d["date"], "title": d["title"], "fastingLevel": d["fastingLevel"]})
    return out


MARIAN_PATTERNS = [
    r"^The Nativity of Our Most Holy Lady",
    r"^The Entrance of the Theotokos",
    r"^Annunciation of the Theotokos",
    r"^The Dormition of our Most Holy Lady",
    r"^The Holy Protection of the Theotokos",
    r"^The Conception by St\. Anna",
    r"^Synaxis of the Holy Theotokos",
]


def marian_feasts(days):
    out, seen = [], set()
    for d in days:
        for pat in MARIAN_PATTERNS:
            if re.search(pat, d["title"], re.I):
                key = (pat, d["date"][:7])
                if key in seen:
                    continue
                seen.add(key)
                out.append({"date": d["date"], "title": d["title"],
                            "fastingLevel": d["fastingLevel"]})
                break
    return out


def find_fast_free(days):
    """Runs of six or more days with no fasting obligation — the true fast-free weeks."""
    out, run = [], []
    for d in days:
        if d["fastingLevel"] in ("fast-free", "none"):
            run.append(d)
        else:
            if len(run) >= 6:
                out.append({"start": run[0]["date"], "end": run[-1]["date"], "days": len(run)})
            run = []
    if len(run) >= 6:
        out.append({"start": run[0]["date"], "end": run[-1]["date"], "days": len(run)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ics")
    ap.add_argument("out")
    ap.add_argument("--with-readings", action="store_true",
                    help="embed the full scripture text — personal use only, do not publish")
    args = ap.parse_args()

    days = parse(args.ics, args.with_readings)
    if not days:
        sys.exit("No events found. Is that the English Planner ICS?")

    doc = {
        "sourceName": "GOARCH Planner: Ecclesiastical Digital Calendar",
        "sourceUrl": "https://www.goarch.org/chapel/planner",
        "chapelUrl": "https://www.goarch.org/chapel/calendar",
        "generated": datetime.date.today().isoformat(),
        "includesReadingText": bool(args.with_readings),
        "rangeStart": days[0]["date"],
        "rangeEnd": days[-1]["date"],
        "dayCount": len(days),
        "seasons": find_seasons(days),
        "fastFreePeriods": find_fast_free(days),
        "paschalCycle": tag_cycles(days),
        "wedFriExceptions": wedfri_exceptions(days),
        "marianFeasts": marian_feasts(days),
        "greatFeasts": [
            {"date": d["date"], "name": d["greatFeast"], "title": d["title"],
             "fastingLevel": d["fastingLevel"]}
            for d in days if d.get("greatFeast")
        ],
        "days": days,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))

    counts = {}
    for d in days:
        counts[d["fastingLevel"]] = counts.get(d["fastingLevel"], 0) + 1
    print(f"{len(days)} days  {doc['rangeStart']} → {doc['rangeEnd']}")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {v:>4}  {k}")
    print(f"  {len(doc['seasons'])} fasting seasons detected")


if __name__ == "__main__":
    main()
