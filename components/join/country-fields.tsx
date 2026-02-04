"use client";

import { useMemo, useState } from "react";

export function CountryFields() {
  const options = useMemo(
    () => ["Jamaica", "United States", "Canada", "United Kingdom", "Other"],
    []
  );

  const [country, setCountry] = useState<string>("Jamaica");

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm font-medium">Country</label>
        <select
          name="country"
          className="w-full rounded border px-3 py-2"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          {options.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="text-xs opacity-60">Helps us tailor benefits and contact preferences.</p>
      </div>

      {country === "Other" ? (
        <div className="space-y-1">
          <label className="text-sm font-medium">Which country?</label>
          <input
            name="other_country"
            className="w-full rounded border px-3 py-2"
            placeholder="Type your country"
            autoComplete="country-name"
          />
          <p className="text-xs opacity-60">Only shown when “Other” is selected.</p>
        </div>
      ) : (
        // keep the field present but empty so server action can always read it safely
        <input type="hidden" name="other_country" value="" />
      )}
    </>
  );
}
