// https://currency-api.pages.dev/v1/currencies/usd.json

type CurrencyRates = {
  [key: string]: number;
};

type CurrencyApiResponse = {
  date: string;
  usd: CurrencyRates;
};

// singleton currency rates object
let todayCurrencyRatesUsd: CurrencyApiResponse | undefined = undefined;

export const getUSDConversionRate = async (currency: string) => {
  if (!todayCurrencyRatesUsd) {
    const response = await fetch(
      "https://currency-api.pages.dev/v1/currencies/usd.json",
      {
        next: {
          revalidate: 86400, // 24 hours in seconds
        },
      }
    );
    const data = await response.json();
    todayCurrencyRatesUsd = data;
  }

  if (!todayCurrencyRatesUsd) {
    throw new Error("Currency rates not found");
  }

  const rate = todayCurrencyRatesUsd.usd[currency.toLowerCase()];

  return rate;
};
