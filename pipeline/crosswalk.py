"""District crosswalk: every source's (state, district) name → one canonical id.

Canonical districts are the 641 Census 2011 districts in the DataMeet boundary
file (ids look like ``d572`` from the census code). Matching is deterministic:

1. an explicit row in ``data/reference/district_aliases.csv`` (hand-written,
   reviewed, with a method: ``rename`` or ``carved_principal_parent``), else
2. an exact match after normalisation (lower-case, "&" → "and", drop every
   non-letter) within the source state's census state(s).

Nothing is matched by similarity scores. Unmatched names are returned to the
caller and listed in the validation report.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "data" / "reference"
RAW = ROOT / "data" / "raw"

# Two-letter state codes (ISO 3166-2:IN style) keyed by the census state name.
STATE_CODE = {
    "Andaman & Nicobar Island": "AN", "Andhra Pradesh": "AP", "Arunanchal Pradesh": "AR", "Assam": "AS",
    "Bihar": "BR", "Chandigarh": "CH", "Chhattisgarh": "CG", "Dadara & Nagar Havelli": "DN",
    "Daman & Diu": "DD", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR", "Himachal Pradesh": "HP",
    "Jammu & Kashmir": "JK", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL", "Lakshadweep": "LD",
    "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML", "Mizoram": "MZ",
    "NCT of Delhi": "DL", "Nagaland": "NL", "Odisha": "OD", "Puducherry": "PY", "Punjab": "PB",
    "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Tripura": "TR", "Uttar Pradesh": "UP",
    "Uttarakhand": "UK", "West Bengal": "WB",
}
# Display names for states (census spellings are kept as keys only).
STATE_DISPLAY = {
    "Andaman & Nicobar Island": "Andaman & Nicobar Islands", "Arunanchal Pradesh": "Arunachal Pradesh",
    "Dadara & Nagar Havelli": "Dadra & Nagar Haveli", "NCT of Delhi": "Delhi",
}


def norm(s: object) -> str:
    s = str(s).lower().replace("&", "and")
    return re.sub(r"[^a-z]", "", s)


# Per-source state spellings → candidate census states.
_CENSUS_STATES = list(STATE_CODE)
_STATE_ALIASES = {
    "andamanandnicobarislands": ["Andaman & Nicobar Island"],
    "andamanandnicobarisland": ["Andaman & Nicobar Island"],
    "arunachalpradesh": ["Arunanchal Pradesh"],
    "telangana": ["Andhra Pradesh"],
    "ladakh": ["Jammu & Kashmir"],
    "thedadraandnagarhavelianddamananddiu": ["Dadara & Nagar Havelli", "Daman & Diu"],
    "dadraandnagarhaveli": ["Dadara & Nagar Havelli"],
    "dadarnagarhaveli": ["Dadara & Nagar Havelli"],
    "damananddui": ["Daman & Diu"],
    "damananddiu": ["Daman & Diu"],
    "delhi": ["NCT of Delhi"],
    "orissa": ["Odisha"],
    "uttaranchal": ["Uttarakhand"],
    "chatisgarh": ["Chhattisgarh"],
    "himachal": ["Himachal Pradesh"],
    "pondicherry": ["Puducherry"],
    # CGWB two-letter codes
    "tg": ["Andhra Pradesh"], "up": ["Uttar Pradesh"], "gj": ["Gujarat"], "ms": ["Maharashtra"],
    "pb": ["Punjab"], "rj": ["Rajasthan"], "mp": ["Madhya Pradesh"], "kl": ["Kerala"], "hr": ["Haryana"],
    "jk": ["Jammu & Kashmir"], "ap": ["Andhra Pradesh"], "od": ["Odisha"], "br": ["Bihar"],
    "tn": ["Tamil Nadu"], "ka": ["Karnataka"], "wb": ["West Bengal"], "cg": ["Chhattisgarh"],
    "mn": ["Manipur"], "jh": ["Jharkhand"], "ar": ["Arunanchal Pradesh"], "tr": ["Tripura"],
    "nl": ["Nagaland"], "ml": ["Meghalaya"], "hp": ["Himachal Pradesh"],
    # GADM spellings (hssling district → subdivision map)
    "andamanandnicobar": ["Andaman & Nicobar Island"],
    "nctofdelhi": ["NCT of Delhi"],
}


def census_states_for(source_state: str) -> list[str]:
    k = norm(source_state)
    if k in _STATE_ALIASES:
        return _STATE_ALIASES[k]
    for cs in _CENSUS_STATES:
        if norm(cs) == k:
            return [cs]
    return []


@lru_cache(maxsize=1)
def canonical_districts() -> pd.DataFrame:
    """Canonical district table with centroids and areas (from the boundary file)."""
    import geopandas as gpd

    g = gpd.read_file(RAW / "boundaries" / "2011_Dist.shp")
    g = g[g["DISTRICT"].str.strip().str.lower() != "data not available"].copy()
    g["district_id"] = "d" + g["censuscode"].astype(int).astype(str)
    eq = g.to_crs(6933)  # equal-area for km²
    g["area_km2"] = (eq.geometry.area / 1e6).round(1)
    rp = g.geometry.representative_point()
    g["lat"] = rp.y.round(4)
    g["lon"] = rp.x.round(4)
    g["state_code"] = g["ST_NM"].map(STATE_CODE)
    g["state_name"] = g["ST_NM"].map(lambda s: STATE_DISPLAY.get(s, s))
    return g.rename(columns={"DISTRICT": "district_name", "ST_NM": "census_state", "censuscode": "census_code"})


@dataclass
class Matcher:
    source: str
    aliases: dict[tuple[str, str], tuple[str, str]] = field(default_factory=dict)
    by_state: dict[str, dict[str, str]] = field(default_factory=dict)
    unmatched: dict[tuple[str, str], int] = field(default_factory=dict)
    matched: dict[tuple[str, str], tuple[str, str]] = field(default_factory=dict)

    @classmethod
    def for_source(cls, source: str) -> "Matcher":
        cd = canonical_districts()
        by_state: dict[str, dict[str, str]] = {}
        for r in cd.itertuples():
            by_state.setdefault(r.census_state, {})[norm(r.district_name)] = r.district_id
        al = pd.read_csv(REF / "district_aliases.csv")
        al = al[al["source"] == source]
        aliases = {}
        for r in al.itertuples():
            did = by_state.get(r.census_state, {}).get(norm(r.census_district))
            if did is None:
                raise ValueError(f"alias target not found: {r.census_state} / {r.census_district}")
            aliases[(r.census_state, norm(r.source_name))] = (did, r.method)
        return cls(source=source, aliases=aliases, by_state=by_state)

    def resolve(self, state: str, district: str, weight: int = 1) -> str | None:
        key = (str(state).strip(), str(district).strip())
        if key in self.matched:
            return self.matched[key][0]
        states = census_states_for(key[0])
        n = norm(key[1])
        for cs in states:
            if (cs, n) in self.aliases:
                self.matched[key] = self.aliases[(cs, n)]
                return self.matched[key][0]
        for cs in states:
            did = self.by_state.get(cs, {}).get(n)
            if did:
                self.matched[key] = (did, "exact_normalised")
                return did
        self.unmatched[key] = self.unmatched.get(key, 0) + weight
        return None

    def crosswalk_rows(self) -> list[dict]:
        rows = [
            {"source": self.source, "source_state": s, "source_district": d, "district_id": did, "method": m}
            for (s, d), (did, m) in sorted(self.matched.items())
        ]
        rows += [
            {"source": self.source, "source_state": s, "source_district": d, "district_id": "", "method": "unmatched"}
            for (s, d) in sorted(self.unmatched)
        ]
        return rows
