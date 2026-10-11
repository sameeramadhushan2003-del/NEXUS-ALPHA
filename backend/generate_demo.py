"""Deterministic SYNTHETIC daily prices for UI development, NOT market evidence."""
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent

def generate(path: Path = HERE / 'data' / 'demo_prices.csv', seed: int = 47):
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range(end='2026-10-09', periods=225)
    n = len(dates)
    common = rng.normal(0.0004, 0.011, n)
    tech = rng.normal(0.0002, 0.013, n)
    crypto = np.empty(n)
    crypto[:95] = 0.76 * common[:95] + rng.normal(0, .011, 95)
    crypto[95:160] = -0.07 * common[95:160] + rng.normal(0, .019, 65)
    crypto[160:] = 0.42 * common[160:] + rng.normal(0, .016, n-160)
    eth = .78 * crypto + rng.normal(0, .013, n)
    nvda = .62 * common + .8 * tech + rng.normal(0, .009, n)
    tsla = .38 * common + .55 * tech + rng.normal(0, .018, n)
    rnvda = nvda + rng.normal(0, .007, n)
    rtsla = tsla + rng.normal(0, .008, n)
    all_returns = {'rNVDA':rnvda,'NVDA':nvda,'BTC':crypto,'rTSLA':rtsla,'TSLA':tsla,'ETH':eth}
    starts = {'rNVDA':170,'NVDA':170,'BTC':68000,'rTSLA':230,'TSLA':230,'ETH':3500}
    rows=[]
    for sym, returns in all_returns.items():
        closes = starts[sym]*np.cumprod(1+np.clip(returns,-.25,.25))
        for d, p in zip(dates, closes):
            rows.append({'date':d.strftime('%Y-%m-%d'),'asset':sym,'close':round(float(p),4)})
    path.parent.mkdir(exist_ok=True,parents=True)
    pd.DataFrame(rows).to_csv(path,index=False)
    return path

if __name__ == '__main__':
    print(f'SYNTHETIC sample generated at {generate()}')
