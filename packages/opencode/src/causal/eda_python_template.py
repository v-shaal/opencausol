"""
Causal Exploratory Data Analysis Template
==========================================

This template provides a comprehensive framework for conducting EDA specifically
designed for causal inference studies. It includes all essential diagnostics
for causal assumptions and data quality assessment.

Usage:
    python causal_eda_template.py --config config.json --data data.csv --output results/

Requirements:
    - pandas
    - numpy
    - matplotlib
    - seaborn
    - scipy
    - statsmodels
    - sklearn
    - plotly (for interactive plots)
    - missingno (for missingness visualization)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional
import warnings
warnings.filterwarnings('ignore')

# Statistical packages
from scipy import stats
from scipy.stats import chi2_contingency
import statsmodels.api as sm
import statsmodels.formula.api as smf
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, roc_curve

# Missing data visualization
try:
    import missingno as msno
    HAS_MISSSINGNO = True
except ImportError:
    HAS_MISSSINGNO = False
    print("missingno not installed. Missingness plots will be skipped.")

# Causal inference packages
try:
    from causalinference import CausalModel
    HAS_CAUSALINFERENCE = True
except ImportError:
    HAS_CAUSALINFERENCE = False
    print("causalinference not installed. Some causal diagnostics will be skipped.")

class CausalEDA:
    """
    Comprehensive EDA class for causal inference studies
    """
    
    def __init__(self, data: pd.DataFrame, config: Dict[str, Any]):
        """
        Initialize CausalEDA with data and configuration
        
        Args:
            data: Input dataset
            config: Configuration dictionary with variable roles and specifications
        """
        self.data = data.copy()
        self.config = config
        self.results = {}
        
        # Extract variable roles from config
        self.treatment_vars = config.get('treatment_variables', [])
        self.outcome_vars = config.get('outcome_variables', [])
        self.covariate_vars = config.get('covariate_variables', [])
        self.instrument_vars = config.get('instrument_variables', [])
        
        # Validate required variables exist
        self._validate_variables()
        
    def _validate_variables(self):
        """Validate that all specified variables exist in the dataset"""
        all_vars = (self.treatment_vars + self.outcome_vars + 
                   self.covariate_vars + self.instrument_vars)
        
        missing_vars = [var for var in all_vars if var not in self.data.columns]
        if missing_vars:
            raise ValueError(f"Variables not found in dataset: {missing_vars}")
    
    def profile_data(self) -> Dict[str, Any]:
        """
        Comprehensive data profiling
        
        Returns:
            Dictionary containing data profiling results
        """
        print("🔍 Profiling data...")
        
        profile = {
            'total_observations': len(self.data),
            'total_variables': len(self.data.columns),
            'variables': {}
        }
        
        for col in self.data.columns:
            var_info = self._profile_variable(col)
            profile['variables'][col] = var_info
            
        # Overall data quality
        profile['overall_data_quality'] = self._assess_overall_quality()
        
        self.results['data_profiling'] = profile
        return profile
    
    def _profile_variable(self, var_name: str) -> Dict[str, Any]:
        """Profile individual variable"""
        series = self.data[var_name]
        var_type = self._infer_variable_type(series)
        
        profile = {
            'type': var_type,
            'missing_count': series.isnull().sum(),
            'missing_percentage': series.isnull().sum() / len(series) * 100,
            'unique_values': series.nunique(),
        }
        
        if var_type == 'binary':
            profile.update(self._profile_binary(series))
        elif var_type == 'categorical':
            profile.update(self._profile_categorical(series))
        elif var_type == 'continuous':
            profile.update(self._profile_continuous(series))
        elif var_type == 'count':
            profile.update(self._profile_count(series))
            
        # Validation
        profile['validation'] = self._validate_variable(var_name, profile)
        
        return profile
    
    def _infer_variable_type(self, series: pd.Series) -> str:
        """Infer variable type from data characteristics"""
        if series.dtype == 'bool' or (series.dtype == 'object' and series.nunique() == 2):
            return 'binary'
        elif series.dtype == 'object':
            return 'categorical'
        elif pd.api.types.is_numeric_dtype(series):
            if series.min() >= 0 and series.nunique() < 50:
                return 'count'
            else:
                return 'continuous'
        else:
            return 'unknown'
    
    def _profile_binary(self, series: pd.Series) -> Dict[str, Any]:
        """Profile binary variable"""
        value_counts = series.value_counts()
        total = len(series.dropna())
        
        return {
            'distribution': {
                '0': int(value_counts.get(0, 0)),
                '1': int(value_counts.get(1, 0)),
                'rate': float(value_counts.get(1, 0) / total) if total > 0 else 0
            }
        }
    
    def _profile_categorical(self, series: pd.Series) -> Dict[str, Any]:
        """Profile categorical variable"""
        value_counts = series.value_counts()
        total = len(series.dropna())
        
        return {
            'distribution': {
                'category_counts': value_counts.to_dict(),
                'category_percentages': (value_counts / total * 100).round(2).to_dict()
            }
        }
    
    def _profile_continuous(self, series: pd.Series) -> Dict[str, Any]:
        """Profile continuous variable"""
        clean_series = series.dropna()
        
        # Calculate statistics
        stats_dict = {
            'mean': float(clean_series.mean()),
            'median': float(clean_series.median()),
            'std': float(clean_series.std()),
            'min': float(clean_series.min()),
            'max': float(clean_series.max()),
            'q25': float(clean_series.quantile(0.25)),
            'q75': float(clean_series.quantile(0.75)),
            'skewness': float(clean_series.skew()),
            'kurtosis': float(clean_series.kurtosis())
        }
        
        # Outlier detection using IQR method
        Q1, Q3 = stats_dict['q25'], stats_dict['q75']
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outliers = clean_series[(clean_series < lower_bound) | (clean_series > upper_bound)]
        
        stats_dict.update({
            'outliers_count': len(outliers),
            'outliers_percentage': len(outliers) / len(clean_series) * 100
        })
        
        return {'statistics': stats_dict}
    
    def _profile_count(self, series: pd.Series) -> Dict[str, Any]:
        """Profile count variable"""
        clean_series = series.dropna()
        
        return {
            'statistics': {
                'mean': float(clean_series.mean()),
                'median': float(clean_series.median()),
                'std': float(clean_series.std()),
                'min': int(clean_series.min()),
                'max': int(clean_series.max()),
                'zero_inflation': (clean_series == 0).sum() / len(clean_series) * 100
            }
        }
    
    def _validate_variable(self, var_name: str, profile: Dict[str, Any]) -> str:
        """Validate variable against expected specifications"""
        missing_pct = profile['missing_percentage']
        
        # Check missingness
        if missing_pct > 20:
            return "FAIL - High missingness > 20%"
        elif missing_pct > 5:
            return "WARNING - Moderate missingness > 5%"
        
        # Check for binary variables with invalid values
        if profile['type'] == 'binary':
            if profile['distribution']['0'] + profile['distribution']['1'] != len(self.data[var_name].dropna()):
                return "FAIL - Invalid values in binary variable"
        
        # Check for continuous variables with extreme outliers
        if profile['type'] == 'continuous':
            outlier_pct = profile['statistics']['outliers_percentage']
            if outlier_pct > 10:
                return "WARNING - High outlier percentage > 10%"
        
        return "PASS - No major issues detected"
    
    def _assess_overall_quality(self) -> Dict[str, Any]:
        """Assess overall data quality"""
        complete_cases = len(self.data.dropna())
        total_obs = len(self.data)
        
        # Check critical variables (treatment and outcome)
        critical_vars = self.treatment_vars + self.outcome_vars
        critical_missing = any(
            self.data[var].isnull().sum() / len(self.data) > 0.05 
            for var in critical_vars if var in self.data.columns
        )
        
        # Calculate data quality score (0-1)
        quality_score = complete_cases / total_obs
        if critical_missing:
            quality_score *= 0.8  # Penalize for critical missingness
        
        return {
            'complete_cases': complete_cases,
            'complete_case_percentage': complete_cases / total_obs * 100,
            'critical_variables_missingness': "PASS" if not critical_missing else "FAIL",
            'data_quality_score': round(quality_score, 3),
            'duplicate_records': self.data.duplicated().sum(),
            'duplicate_percentage': self.data.duplicated().sum() / total_obs * 100
        }
    
    def analyze_missingness(self) -> Dict[str, Any]:
        """
        Comprehensive missing data analysis
        
        Returns:
            Dictionary containing missingness analysis results
        """
        print("🔍 Analyzing missingness patterns...")
        
        missing_analysis = {
            'patterns': self._analyze_missingness_patterns(),
            'missingness_mechanism': self._assess_missingness_mechanism(),
            'impact_assessment': self._assess_missingness_impact()
        }
        
        self.results['missingness_analysis'] = missing_analysis
        return missing_analysis
    
    def _analyze_missingness_patterns(self) -> Dict[str, Any]:
        """Analyze patterns of missingness"""
        missing_matrix = self.data.isnull()
        
        # Check for monotone missingness
        monotone = True
        for i in range(1, len(missing_matrix.columns)):
            if not missing_matrix.iloc[:, i].ge(missing_matrix.iloc[:, i-1]).all():
                monotone = False
                break
        
        # Correlation of missingness indicators
        missing_corr = missing_matrix.corr()
        
        return {
            'monotone_missing': monotone,
            'missingness_correlation': missing_corr.to_dict(),
            'missingness_heatmap_data': missing_matrix.astype(int).values.tolist()
        }
    
    def _assess_missingness_mechanism(self) -> Dict[str, Any]:
        """Assess likely missingness mechanism"""
        # Simple heuristic assessment
        missing_patterns = []
        
        for var in self.data.columns:
            if self.data[var].isnull().sum() > 0:
                # Check if missingness correlates with other variables
                missing_indicator = self.data[var].isnull().astype(int)
                correlations = []
                
                for other_var in self.data.columns:
                    if other_var != var and self.data[other_var].dtype in ['int64', 'float64']:
                        corr = missing_indicator.corr(self.data[other_var])
                        if abs(corr) > 0.1:
                            correlations.append(f"{other_var}: {corr:.3f}")
                
                if correlations:
                    missing_patterns.append(f"{var}: {', '.join(correlations)}")
        
        mechanism = "MCAR" if not missing_patterns else "MAR"
        
        return {
            'assessment': mechanism,
            'rationale': f"Missingness patterns detected: {'; '.join(missing_patterns[:3])}" if missing_patterns else "No clear patterns detected",
            'recommendation': "Multiple imputation" if mechanism == "MAR" else "Complete case analysis"
        }
    
    def _assess_missingness_impact(self) -> Dict[str, Any]:
        """Assess impact of missingness on causal estimation"""
        # Check missingness in treatment and outcome
        treatment_missing = any(
            self.data[var].isnull().sum() > 0 for var in self.treatment_vars
        )
        outcome_missing = any(
            self.data[var].isnull().sum() > 0 for var in self.outcome_vars
        )
        
        treatment_risk = "HIGH" if treatment_missing else "LOW"
        outcome_risk = "HIGH" if outcome_missing else "LOW"
        
        return {
            'treatment_effect_bias_risk': treatment_risk,
            'selection_bias_risk': outcome_risk,
            'recommended_approach': "Multiple imputation" if outcome_missing else "Complete case analysis"
        }
    
    def assess_overlap_positivity(self) -> Dict[str, Any]:
        """
        Assess overlap and positivity assumptions
        
        Returns:
            Dictionary containing overlap assessment results
        """
        print("🔍 Assessing overlap and positivity...")
        
        if len(self.treatment_vars) != 1:
            print("Warning: Overlap assessment designed for single binary treatment")
            return {}
        
        treatment_var = self.treatment_vars[0]
        
        overlap_analysis = {
            'propensity_score_analysis': self._analyze_propensity_scores(treatment_var),
            'covariate_balance': self._assess_covariate_balance(treatment_var),
            'positivity_validation': self._validate_positivity()
        }
        
        self.results['overlap_positivity_assessment'] = overlap_analysis
        return overlap_analysis
    
    def _analyze_propensity_scores(self, treatment_var: str) -> Dict[str, Any]:
        """Analyze propensity score distributions"""
        if not self.covariate_vars:
            return {"error": "No covariates specified for propensity score estimation"}
        
        # Prepare data for propensity score modeling
        ps_data = self.data[[treatment_var] + self.covariate_vars].dropna()
        
        if len(ps_data) < len(self.data) * 0.8:
            return {"error": "Too much missing data for propensity score estimation"}
        
        # Create design matrix
        X = ps_data[self.covariate_vars]
        y = ps_data[treatment_var]
        
        # Handle categorical variables
        X_encoded = pd.get_dummies(X, drop_first=True)
        
        # Fit logistic regression
        try:
            model = sm.Logit(y, sm.add_constant(X_encoded))
            result = model.fit(disp=0)
            
            # Get propensity scores
            propensity_scores = result.predict(sm.add_constant(X_encoded))
            
            # Analyze overlap
            in_overlap = (propensity_scores >= 0.1) & (propensity_scores <= 0.9)
            
            treated_mask = y == 1
            control_mask = y == 0
            
            return {
                'model': f"Logistic regression with {len(X_encoded.columns)} predictors",
                'propensity_score_range': {
                    'min': float(propensity_scores.min()),
                    'max': float(propensity_scores.max()),
                    'mean': float(propensity_scores.mean()),
                    'median': float(propensity_scores.median())
                },
                'overlap_statistics': {
                    'observations_in_0.1_0.9_range': int(in_overlap.sum()),
                    'percentage_in_overlap': float(in_overlap.mean() * 100),
                    'treated_in_overlap': int((in_overlap & treated_mask).sum()),
                    'control_in_overlap': int((in_overlap & control_mask).sum())
                },
                'positivity_violation': {
                    'count_below_0.1': int((propensity_scores < 0.1).sum()),
                    'count_above_0.9': int((propensity_scores > 0.9).sum()),
                    'total_violations': int(((propensity_scores < 0.1) | (propensity_scores > 0.9)).sum()),
                    'violation_percentage': float(((propensity_scores < 0.1) | (propensity_scores > 0.9)).mean() * 100)
                }
            }
        except Exception as e:
            return {"error": f"Propensity score estimation failed: {str(e)}"}
    
    def _assess_covariate_balance(self, treatment_var: str) -> Dict[str, Any]:
        """Assess covariate balance between treatment groups"""
        balance_results = {'standardized_mean_differences': {}}
        
        for covariate in self.covariate_vars:
            if covariate not in self.data.columns:
                continue
                
            treated = self.data[self.data[treatment_var] == 1][covariate].dropna()
            control = self.data[self.data[treatment_var] == 0][covariate].dropna()
            
            if len(treated) == 0 or len(control) == 0:
                continue
            
            # Calculate standardized mean difference
            mean_treated = treated.mean()
            mean_control = control.mean()
            pooled_std = np.sqrt((treated.var() + control.var()) / 2)
            
            if pooled_std > 0:
                smd = abs(mean_treated - mean_control) / pooled_std
                balance_results['standardized_mean_differences'][covariate] = float(smd)
        
        # Categorize balance
        smd_dict = balance_results['standardized_mean_differences']
        balanced = [k for k, v in smd_dict.items() if v < 0.1]
        moderate = [k for k, v in smd_dict.items() if 0.1 <= v < 0.2]
        imbalanced = [k for k, v in smd_dict.items() if v >= 0.2]
        
        balance_results['balance_assessment'] = {
            'variables_balanced_smd_0.1': balanced,
            'variables_moderately_imbalanced_smd_0.1_0.2': moderate,
            'variables_imbalanced_smd_0.2': imbalanced,
            'overall_balance': 'GOOD' if len(imbalanced) == 0 else 'MODERATE' if len(imbalanced) <= 2 else 'POOR'
        }
        
        return balance_results
    
    def _validate_positivity(self) -> Dict[str, Any]:
        """Validate positivity assumption"""
        if 'overlap_positivity_assessment' not in self.results:
            return {'criteria_met': 'UNKNOWN', 'recommendation': 'Run overlap assessment first'}
        
        overlap_pct = self.results['overlap_positivity_assessment']['propensity_score_analysis'].get('overlap_statistics', {}).get('percentage_in_overlap', 0)
        
        criteria_met = 'PASS' if overlap_pct >= 80 else 'FAIL'
        recommendation = 'Good overlap' if overlap_pct >= 80 else 'Consider trimming extreme propensity scores'
        
        return {
            'criteria_met': criteria_met,
            'recommendation': recommendation
        }
    
    def analyze_correlations(self) -> Dict[str, Any]:
        """
        Analyze correlations between variables
        
        Returns:
            Dictionary containing correlation analysis results
        """
        print("🔍 Analyzing correlations...")
        
        correlation_analysis = {
            'treatment_covariate_correlations': {},
            'outcome_correlations': {},
            'multicollinearity_check': {},
            'instrument_relevance': {}
        }
        
        # Treatment-covariate correlations
        for treatment_var in self.treatment_vars:
            if treatment_var not in self.data.columns:
                continue
                
            correlation_analysis['treatment_covariate_correlations'][treatment_var] = {}
            
            for covariate in self.covariate_vars:
                if covariate not in self.data.columns:
                    continue
                    
                # Handle different variable types
                if self.data[covariate].dtype in ['int64', 'float64']:
                    corr = self.data[treatment_var].corr(self.data[covariate])
                    correlation_analysis['treatment_covariate_correlations'][treatment_var][covariate] = float(corr)
        
        # Outcome correlations
        for outcome_var in self.outcome_vars:
            if outcome_var not in self.data.columns:
                continue
                
            correlation_analysis['outcome_correlations'][outcome_var] = {}
            
            # Correlation with treatment
            for treatment_var in self.treatment_vars:
                if treatment_var in self.data.columns:
                    corr = self.data[outcome_var].corr(self.data[treatment_var])
                    correlation_analysis['outcome_correlations'][outcome_var]['correlation_with_treatment'] = float(corr)
            
            # Correlations with covariates
            correlation_analysis['outcome_correlations'][outcome_var]['correlations_with_covariates'] = {}
            for covariate in self.covariate_vars:
                if covariate in self.data.columns and self.data[covariate].dtype in ['int64', 'float64']:
                    corr = self.data[outcome_var].corr(self.data[covariate])
                    correlation_analysis['outcome_correlations'][outcome_var]['correlations_with_covariates'][covariate] = float(corr)
        
        # Multicollinearity check
        correlation_analysis['multicollinearity_check'] = self._check_multicollinearity()
        
        # Instrument relevance (if instruments available)
        if self.instrument_vars:
            correlation_analysis['instrument_relevance'] = self._check_instrument_relevance()
        
        self.results['correlation_analysis'] = correlation_analysis
        return correlation_analysis
    
    def _check_multicollinearity(self) -> Dict[str, Any]:
        """Check for multicollinearity among covariates"""
        numeric_covariates = [
            var for var in self.covariate_vars 
            if var in self.data.columns and self.data[var].dtype in ['int64', 'float64']
        ]
        
        if len(numeric_covariates) < 2:
            return {'multicollinearity_assessment': 'INSUFFICIENT_DATA'}
        
        # Calculate VIFs
        X = self.data[numeric_covariates].dropna()
        if len(X) < len(self.data) * 0.8:
            return {'multicollinearity_assessment': 'TOO_MUCH_MISSING_DATA'}
        
        vif_dict = {}
        for i, var in enumerate(numeric_covariates):
            other_vars = [v for v in numeric_covariates if v != var]
            if len(other_vars) == 0:
                vif_dict[var] = 1.0
                continue
                
            y = X[var]
            X_other = X[other_vars]
            
            try:
                model = sm.OLS(y, sm.add_constant(X_other)).fit()
                vif = 1 / (1 - model.rsquared)
                vif_dict[var] = float(vif)
            except:
                vif_dict[var] = float('inf')
        
        max_vif = max(vif_dict.values()) if vif_dict else 0
        
        assessment = 'PASS' if max_vif < 5 else 'WARNING' if max_vif < 10 else 'FAIL'
        
        return {
            'variance_inflation_factors': vif_dict,
            'multicollinearity_assessment': assessment
        }
    
    def _check_instrument_relevance(self) -> Dict[str, Any]:
        """Check instrument relevance for IV designs"""
        if not self.instrument_vars or not self.treatment_vars:
            return {'instrument_strength': 'NO_INSTRUMENTS'}
        
        instrument_var = self.instrument_vars[0]
        treatment_var = self.treatment_vars[0]
        
        if instrument_var not in self.data.columns or treatment_var not in self.data.columns:
            return {'instrument_strength': 'MISSING_VARIABLES'}
        
        # First stage regression
        X = self.data[instrument_var]
        y = self.data[treatment_var]
        
        try:
            # Simple linear regression for first stage
            X_const = sm.add_constant(X)
            model = sm.OLS(y, X_const).fit()
            
            # Calculate F-statistic
            f_stat = model.fvalue
            correlation = X.corr(y)
            
            # Compliance rates (simplified)
            compliance_data = self.data[[instrument_var, treatment_var]].dropna()
            always_takers = ((compliance_data[instrument_var] == 0) & (compliance_data[treatment_var] == 1)).sum() / len(compliance_data)
            never_takers = ((compliance_data[instrument_var] == 1) & (compliance_data[treatment_var] == 0)).sum() / len(compliance_data)
            compliers = 1 - always_takers - never_takers
            
            strength = 'STRONG' if f_stat > 10 else 'MODERATE' if f_stat > 4 else 'WEAK'
            
            return {
                'first_stage_f_statistic': float(f_stat),
                'instrument_treatment_correlation': float(correlation),
                'compliance_rates': {
                    'always_takers': float(always_takers),
                    'never_takers': float(never_takers),
                    'compliers': float(compliers)
                },
                'instrument_strength': strength
            }
        except Exception as e:
            return {'instrument_strength': f'ERROR: {str(e)}'}
    
    def generate_visualizations(self, output_dir: str) -> List[str]:
        """
        Generate all recommended visualizations
        
        Args:
            output_dir: Directory to save plots
            
        Returns:
            List of generated plot file paths
        """
        print("📊 Generating visualizations...")
        
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        generated_plots = []
        
        # 1. Propensity score distribution
        if 'overlap_positivity_assessment' in self.results:
            plot_path = self._plot_propensity_scores(output_path)
            if plot_path:
                generated_plots.append(plot_path)
        
        # 2. Love plot for covariate balance
        if 'overlap_positivity_assessment' in self.results:
            plot_path = self._plot_love_plot(output_path)
            if plot_path:
                generated_plots.append(plot_path)
        
        # 3. Missingness pattern heatmap
        if HAS_MISSSINGNO:
            plot_path = self._plot_missingness_pattern(output_path)
            if plot_path:
                generated_plots.append(plot_path)
        
        # 4. Correlation matrix
        plot_path = self._plot_correlation_matrix(output_path)
        if plot_path:
            generated_plots.append(plot_path)
        
        # 5. Outcome distributions
        plot_path = self._plot_outcome_distributions(output_path)
        if plot_path:
            generated_plots.append(plot_path)
        
        return generated_plots
    
    def _plot_propensity_scores(self, output_path: Path) -> Optional[str]:
        """Plot propensity score distributions"""
        try:
            if 'overlap_positivity_assessment' not in self.results:
                return None
            
            # This would need the actual propensity scores from the analysis
            # For now, create a placeholder
            fig, ax = plt.subplots(figsize=(10, 6))
            
            treatment_var = self.treatment_vars[0]
            treated = self.data[self.data[treatment_var] == 1]
            control = self.data[self.data[treatment_var] == 0]
            
            # Simple histogram of treatment assignment (placeholder for propensity scores)
            ax.hist([treated.index, control.index], bins=30, alpha=0.7, label=['Treated', 'Control'])
            ax.set_xlabel('Observation Index (placeholder for propensity scores)')
            ax.set_ylabel('Count')
            ax.set_title('Treatment Assignment Distribution')
            ax.legend()
            
            plot_path = output_path / 'propensity_scores.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return str(plot_path)
        except Exception as e:
            print(f"Error plotting propensity scores: {e}")
            return None
    
    def _plot_love_plot(self, output_path: Path) -> Optional[str]:
        """Plot Love plot for covariate balance"""
        try:
            if 'overlap_positivity_assessment' not in self.results:
                return None
            
            balance_data = self.results['overlap_positivity_assessment']['covariate_balance']['standardized_mean_differences']
            
            if not balance_data:
                return None
            
            fig, ax = plt.subplots(figsize=(10, 8))
            
            variables = list(balance_data.keys())
            smd_values = list(balance_data.values())
            
            colors = ['red' if abs(smd) >= 0.2 else 'orange' if abs(smd) >= 0.1 else 'green' for smd in smd_values]
            
            bars = ax.barh(variables, smd_values, color=colors, alpha=0.7)
            ax.axvline(x=0.1, color='orange', linestyle='--', alpha=0.7, label='SMD = 0.1')
            ax.axvline(x=-0.1, color='orange', linestyle='--', alpha=0.7)
            ax.axvline(x=0.2, color='red', linestyle='--', alpha=0.7, label='SMD = 0.2')
            ax.axvline(x=-0.2, color='red', linestyle='--', alpha=0.7)
            ax.axvline(x=0, color='black', linestyle='-', alpha=0.3)
            
            ax.set_xlabel('Standardized Mean Difference')
            ax.set_title('Covariate Balance (Love Plot)')
            ax.legend()
            
            plt.tight_layout()
            plot_path = output_path / 'love_plot.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return str(plot_path)
        except Exception as e:
            print(f"Error plotting Love plot: {e}")
            return None
    
    def _plot_missingness_pattern(self, output_path: Path) -> Optional[str]:
        """Plot missingness pattern heatmap"""
        try:
            if not HAS_MISSSINGNO:
                return None
            
            fig, ax = plt.subplots(figsize=(12, 8))
            msno.matrix(self.data, ax=ax, sparkline=False)
            ax.set_title('Missing Data Pattern')
            
            plot_path = output_path / 'missingness_pattern.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return str(plot_path)
        except Exception as e:
            print(f"Error plotting missingness pattern: {e}")
            return None
    
    def _plot_correlation_matrix(self, output_path: Path) -> Optional[str]:
        """Plot correlation matrix"""
        try:
            # Select numeric variables
            numeric_vars = self.data.select_dtypes(include=[np.number]).columns
            if len(numeric_vars) < 2:
                return None
            
            corr_matrix = self.data[numeric_vars].corr()
            
            fig, ax = plt.subplots(figsize=(12, 10))
            sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0, 
                       square=True, ax=ax, fmt='.2f')
            ax.set_title('Correlation Matrix')
            
            plt.tight_layout()
            plot_path = output_path / 'correlation_matrix.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return str(plot_path)
        except Exception as e:
            print(f"Error plotting correlation matrix: {e}")
            return None
    
    def _plot_outcome_distributions(self, output_path: Path) -> Optional[str]:
        """Plot outcome distributions by treatment"""
        try:
            if len(self.treatment_vars) != 1 or len(self.outcome_vars) != 1:
                return None
            
            treatment_var = self.treatment_vars[0]
            outcome_var = self.outcome_vars[0]
            
            fig, axes = plt.subplots(1, 2, figsize=(15, 6))
            
            # Boxplot
            self.data.boxplot(column=outcome_var, by=treatment_var, ax=axes[0])
            axes[0].set_title(f'{outcome_var} by {treatment_var}')
            axes[0].set_xlabel(treatment_var)
            axes[0].set_ylabel(outcome_var)
            
            # Histogram
            treated_data = self.data[self.data[treatment_var] == 1][outcome_var].dropna()
            control_data = self.data[self.data[treatment_var] == 0][outcome_var].dropna()
            
            axes[1].hist([treated_data, control_data], bins=30, alpha=0.7, 
                        label=['Treated', 'Control'])
            axes[1].set_xlabel(outcome_var)
            axes[1].set_ylabel('Count')
            axes[1].set_title(f'{outcome_var} Distribution')
            axes[1].legend()
            
            plt.tight_layout()
            plot_path = output_path / 'outcome_distributions.png'
            plt.savefig(plot_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return str(plot_path)
        except Exception as e:
            print(f"Error plotting outcome distributions: {e}")
            return None
    
    def generate_report(self, output_dir: str) -> str:
        """
        Generate comprehensive EDA report
        
        Args:
            output_dir: Directory to save report
            
        Returns:
            Path to generated report
        """
        print("📝 Generating EDA report...")
        
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Create report structure
        report = {
            'eda_metadata': {
                'analysis_date': pd.Timestamp.now().isoformat(),
                'dataset_path': 'dataset.csv',  # Would be passed as parameter
                'total_observations': len(self.data),
                'total_variables': len(self.data.columns),
                'analysis_version': '1.0'
            }
        }
        
        # Add all analysis results
        report.update(self.results)
        
        # Add visualization recommendations
        report['visualization_recommendations'] = {
            'required_plots': [
                {
                    'type': 'propensity_score_distribution',
                    'description': 'Histogram of propensity scores by treatment group',
                    'purpose': 'Assess overlap and positivity',
                    'file_path': 'plots/propensity_scores.png'
                },
                {
                    'type': 'love_plot',
                    'description': 'Standardized mean differences before and after adjustment',
                    'purpose': 'Visualize covariate balance',
                    'file_path': 'plots/love_plot.png'
                },
                {
                    'type': 'missingness_pattern',
                    'description': 'Heatmap of missing data patterns',
                    'purpose': 'Identify missingness mechanisms',
                    'file_path': 'plots/missingness_pattern.png'
                },
                {
                    'type': 'correlation_matrix',
                    'description': 'Correlation matrix of key variables',
                    'purpose': 'Identify multicollinearity and relationships',
                    'file_path': 'plots/correlation_matrix.png'
                },
                {
                    'type': 'outcome_distributions',
                    'description': 'Boxplots/violin plots of outcomes by treatment',
                    'purpose': 'Show treatment effects visually',
                    'file_path': 'plots/outcome_distributions.png'
                }
            ]
        }
        
        # Add next steps
        report['next_steps'] = {
            'immediate_actions': [
                'Review data quality issues',
                'Address missing data patterns',
                'Consider variable transformations'
            ],
            'analysis_pipeline': [
                'Propensity score estimation and adjustment',
                'Primary causal effect estimation',
                'Sensitivity analyses',
                'Robustness checks'
            ]
        }
        
        # Save report
        report_path = output_path / 'eda_report.json'
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        return str(report_path)


def main():
    """Main function for command line usage"""
    parser = argparse.ArgumentParser(description='Causal EDA Template')
    parser.add_argument('--data', required=True, help='Path to dataset')
    parser.add_argument('--config', required=True, help='Path to configuration file')
    parser.add_argument('--output', required=True, help='Output directory')
    
    args = parser.parse_args()
    
    # Load data
    data = pd.read_csv(args.data)
    
    # Load configuration
    with open(args.config, 'r') as f:
        config = json.load(f)
    
    # Initialize EDA
    eda = CausalEDA(data, config)
    
    # Run analyses
    eda.profile_data()
    eda.analyze_missingness()
    eda.assess_overlap_positivity()
    eda.analyze_correlations()
    
    # Generate visualizations
    plots = eda.generate_visualizations(f"{args.output}/plots")
    print(f"Generated {len(plots)} plots")
    
    # Generate report
    report_path = eda.generate_report(args.output)
    print(f"EDA report saved to: {report_path}")


if __name__ == "__main__":
    main()