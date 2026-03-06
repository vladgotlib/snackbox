const kmInput = document.getElementById("km");
const milesInput = document.getElementById("miles");

const KM_PER_MILE = 1.609344;

kmInput.addEventListener("input", () => {
  const km = parseFloat(kmInput.value);
  milesInput.value = isNaN(km) ? "" : (km / KM_PER_MILE).toFixed(4);
});

milesInput.addEventListener("input", () => {
  const miles = parseFloat(milesInput.value);
  kmInput.value = isNaN(miles) ? "" : (miles * KM_PER_MILE).toFixed(4);
});
