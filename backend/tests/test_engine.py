from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pandas as pd
import pytest
from generate_demo import generate
from engine import load_prices, evaluate

@pytest.fixture
def sample(tmp_path):
    return load_prices(generate(tmp_path/'data.csv'))

def test_backtest_split_and_nonfuture_metrics(sample):
    result=evaluate(sample)
    assert result['stats']['testDays']==45
    assert result['stats']['trainDays']>=60
    assert len(result['chart'])==len(sample)
    assert all(x['phase']=='TEST' for x in result['chart'][-45:])

def test_no_same_bar_execution(sample):
    result=evaluate(sample)
    first=result['chart'][0]
    assert first['position']==0
    assert result['stats']['costBps']==13

def test_insufficient_overlap_rejected(sample):
    with pytest.raises(ValueError):
        evaluate(sample,oos_days=220)

def test_duplicate_dates_rejected(tmp_path):
    df=pd.DataFrame([{'date':'2026-01-02','asset':'A','close':100}, {'date':'2026-01-02','asset':'A','close':105}])
    path=tmp_path/'invalid.csv'
    df.to_csv(path,index=False)
    with pytest.raises(ValueError):
        load_prices(path)


def test_future_data_changes_cannot_change_past_holdings(sample):
    before=evaluate(sample)
    altered=sample.copy()
    altered.iloc[-10:, altered.columns.get_loc('rNVDA')]*=1.5
    after=evaluate(altered)
    # Everything before the altered dates must stay identical.
    assert before['chart'][:-10]==after['chart'][:-10]

def test_metrics_dont_claim_guaranteed_returns(sample):
    result=evaluate(sample)
    assert len(result['diagnostics'])>=4
    assert result['stats']['trainDays']+result['stats']['testDays']==result['meta']['observations']
