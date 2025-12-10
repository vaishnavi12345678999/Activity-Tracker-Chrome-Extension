import React from "react";
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const Graph = ({ data = [], mode = "domain" }) => {
  console.log("Graph Data:", data); // debug

  // Group data
  const grouped = {};
  data.forEach((entry) => {
    const key = mode === "domain" ? entry.domain : entry.page;
    if (!key) return;
    grouped[key] = (grouped[key] || 0) + entry.time_spent;
  });

  const chartData = Object.entries(grouped).map(([key, time_spent]) => ({
    name: key,
    time_spent,
  }));

  return (
    <div style={{ width: "100%", height: "300px", minHeight: "300px", marginTop: "20px", border: "1px solid #ccc" }}>
      {chartData.length === 0 ? (
        <p style={{ textAlign: "center", paddingTop: "100px", color: "#999" }}>No activity data to show</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis label={{ value: 'Time (min)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="time_spent" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default Graph;
