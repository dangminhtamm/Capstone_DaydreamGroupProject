"use client";

import { useState, useEffect } from "react";

export default function SearchBar() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            setResults(data);
        };

        // Simple debounce to avoid spamming the API
        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="w-full max-w-md">
            <input
                type="text"
                className="w-full p-2 border rounded text-black"
                placeholder="Search your brain..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            <ul className="mt-2 bg-white border rounded shadow-lg overflow-hidden">
                {results.map((entry: any) => (
                    <li key={entry.id} className="p-3 border-b hover:bg-gray-50 text-gray-800">
                        <p className="text-sm line-clamp-2">{entry.content}</p>
                        <span className="text-xs text-gray-400">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}