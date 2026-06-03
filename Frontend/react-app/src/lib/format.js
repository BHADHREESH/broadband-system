export const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

export const date = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "--");

export const dateTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "--");
