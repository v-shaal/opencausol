#' Causal Exploratory Data Analysis Template
#' ==========================================
#' 
#' This template provides a comprehensive framework for conducting EDA specifically
#' designed for causal inference studies. It includes all essential diagnostics
#' for causal assumptions and data quality assessment.
#' 
#' Usage:
#' source("causal_eda_template.R")
#' eda <- CausalEDA$new(data, config)
#' eda$run_full_analysis(output_dir = "results/")
#' 
#' Requirements:
#' - tidyverse
#' - ggplot2
#' - dplyr
#' - tidyr
#' - purrr
#' - broom
#' - corrplot
#' - VIM
#' - mice
#' - MatchIt
#' - cobalt
#' - causalverse (optional)
#' - plotly (for interactive plots)

library(tidyverse)
library(ggplot2)
library(dplyr)
library(tidyr)
library(purrr)
library(broom)
library(corrplot)
library(VIM)
library(mice)
library(MatchIt)
library(cobalt)
library(plotly)

# Optional packages
tryCatch({
  library(causalverse)
  HAS_CAUSALVERSE <- TRUE
}, error = function(e) {
  HAS_CAUSALVERSE <- FALSE
  message("causalverse not installed. Some advanced causal diagnostics will be skipped.")
})

CausalEDA <- R6::R6Class(
  "CausalEDA",
  
  public = list(
    #' @field data Input dataset
    data = NULL,
    
    #' @field config Configuration list with variable roles
    config = NULL,
    
    #' @field results List to store analysis results
    results = list(),
    
    #' @field treatment_vars Treatment variable names
    treatment_vars = NULL,
    
    #' @field outcome_vars Outcome variable names
    outcome_vars = NULL,
    
    #' @field covariate_vars Covariate variable names
    covariate_vars = NULL,
    
    #' @field instrument_vars Instrument variable names
    instrument_vars = NULL,
    
    #' Initialize CausalEDA object
    #' @param data Input data frame
    #' @param config Configuration list
    initialize = function(data, config) {
      self$data <- data
      self$config <- config
      
      # Extract variable roles
      self$treatment_vars <- config$treatment_variables %||% character(0)
      self$outcome_vars <- config$outcome_variables %||% character(0)
      self$covariate_vars <- config$covariate_variables %||% character(0)
      self$instrument_vars <- config$instrument_variables %||% character(0)
      
      # Validate variables
      private$validate_variables()
    },
    
    #' Run complete EDA analysis
    #' @param output_dir Output directory for results
    run_full_analysis = function(output_dir = "eda_results") {
      cat("🔍 Starting Causal EDA Analysis...\n")
      
      # Create output directory
      if (!dir.exists(output_dir)) {
        dir.create(output_dir, recursive = TRUE)
      }
      
      # Run all analyses
      self$profile_data()
      self$analyze_missingness()
      self$assess_overlap_positivity()
      self$analyze_correlations()
      
      # Generate visualizations
      plots_dir <- file.path(output_dir, "plots")
      if (!dir.exists(plots_dir)) {
        dir.create(plots_dir)
      }
      
      generated_plots <- self$generate_visualizations(plots_dir)
      cat(sprintf("📊 Generated %d plots\n", length(generated_plots)))
      
      # Generate report
      report_path <- self$generate_report(output_dir)
      cat(sprintf("📝 EDA report saved to: %s\n", report_path))
      
      invisible(self$results)
    },
    
    #' Comprehensive data profiling
    profile_data = function() {
      cat("🔍 Profiling data...\n")
      
      profile <- list(
        total_observations = nrow(self$data),
        total_variables = ncol(self$data),
        variables = list()
      )
      
      # Profile each variable
      for (col in names(self$data)) {
        var_info <- private$profile_variable(col)
        profile$variables[[col]] <- var_info
      }
      
      # Overall data quality
      profile$overall_data_quality <- private$assess_overall_quality()
      
      self$results$data_profiling <- profile
      invisible(profile)
    },
    
    #' Analyze missing data patterns
    analyze_missingness = function() {
      cat("🔍 Analyzing missingness patterns...\n")
      
      missing_analysis <- list(
        patterns = private$analyze_missingness_patterns(),
        missingness_mechanism = private$assess_missingness_mechanism(),
        impact_assessment = private$assess_missingness_impact()
      )
      
      self$results$missingness_analysis <- missing_analysis
      invisible(missing_analysis)
    },
    
    #' Assess overlap and positivity assumptions
    assess_overlap_positivity = function() {
      cat("🔍 Assessing overlap and positivity...\n")
      
      if (length(self$treatment_vars) != 1) {
        warning("Overlap assessment designed for single binary treatment")
        return(invisible())
      }
      
      treatment_var <- self$treatment_vars[1]
      
      overlap_analysis <- list(
        propensity_score_analysis = private$analyze_propensity_scores(treatment_var),
        covariate_balance = private$assess_covariate_balance(treatment_var),
        positivity_validation = private$validate_positivity()
      )
      
      self$results$overlap_positivity_assessment <- overlap_analysis
      invisible(overlap_analysis)
    },
    
    #' Analyze correlations between variables
    analyze_correlations = function() {
      cat("🔍 Analyzing correlations...\n")
      
      correlation_analysis <- list(
        treatment_covariate_correlations = list(),
        outcome_correlations = list(),
        multicollinearity_check = private$check_multicollinearity(),
        instrument_relevance = list()
      )
      
      # Treatment-covariate correlations
      for (treatment_var in self$treatment_vars) {
        if (!treatment_var %in% names(self$data)) next
        
        correlation_analysis$treatment_covariate_correlations[[treatment_var]] <- list()
        
        for (covariate in self$covariate_vars) {
          if (!covariate %in% names(self$data)) next
          
          if (is.numeric(self$data[[covariate]])) {
            corr <- cor(self$data[[treatment_var]], self$data[[covariate]], use = "complete.obs")
            correlation_analysis$treatment_covariate_correlations[[treatment_var]][[covariate]] <- as.numeric(corr)
          }
        }
      }
      
      # Outcome correlations
      for (outcome_var in self$outcome_vars) {
        if (!outcome_var %in% names(self$data)) next
        
        correlation_analysis$outcome_correlations[[outcome_var]] <- list()
        
        # Correlation with treatment
        for (treatment_var in self$treatment_vars) {
          if (treatment_var %in% names(self$data)) {
            corr <- cor(self$data[[outcome_var]], self$data[[treatment_var]], use = "complete.obs")
            correlation_analysis$outcome_correlations[[outcome_var]]$correlation_with_treatment <- as.numeric(corr)
          }
        }
        
        # Correlations with covariates
        correlation_analysis$outcome_correlations[[outcome_var]]$correlations_with_covariates <- list()
        for (covariate in self$covariate_vars) {
          if (covariate %in% names(self$data) && is.numeric(self$data[[covariate]])) {
            corr <- cor(self$data[[outcome_var]], self$data[[covariate]], use = "complete.obs")
            correlation_analysis$outcome_correlations[[outcome_var]]$correlations_with_covariates[[covariate]] <- as.numeric(corr)
          }
        }
      }
      
      # Instrument relevance
      if (length(self$instrument_vars) > 0) {
        correlation_analysis$instrument_relevance <- private$check_instrument_relevance()
      }
      
      self$results$correlation_analysis <- correlation_analysis
      invisible(correlation_analysis)
    },
    
    #' Generate all recommended visualizations
    #' @param output_dir Directory to save plots
    generate_visualizations = function(output_dir) {
      cat("📊 Generating visualizations...\n")
      
      generated_plots <- character(0)
      
      # 1. Propensity score distribution
      if ("overlap_positivity_assessment" %in% names(self$results)) {
        plot_path <- private$plot_propensity_scores(output_dir)
        if (!is.null(plot_path)) generated_plots <- c(generated_plots, plot_path)
      }
      
      # 2. Love plot for covariate balance
      if ("overlap_positivity_assessment" %in% names(self$results)) {
        plot_path <- private$plot_love_plot(output_dir)
        if (!is.null(plot_path)) generated_plots <- c(generated_plots, plot_path)
      }
      
      # 3. Missingness pattern heatmap
      plot_path <- private$plot_missingness_pattern(output_dir)
      if (!is.null(plot_path)) generated_plots <- c(generated_plots, plot_path)
      
      # 4. Correlation matrix
      plot_path <- private$plot_correlation_matrix(output_dir)
      if (!is.null(plot_path)) generated_plots <- c(generated_plots, plot_path)
      
      # 5. Outcome distributions
      plot_path <- private$plot_outcome_distributions(output_dir)
      if (!is.null(plot_path)) generated_plots <- c(generated_plots, plot_path)
      
      invisible(generated_plots)
    },
    
    #' Generate comprehensive EDA report
    #' @param output_dir Directory to save report
    generate_report = function(output_dir) {
      cat("📝 Generating EDA report...\n")
      
      # Create report structure
      report <- list(
        eda_metadata = list(
          analysis_date = Sys.time(),
          total_observations = nrow(self$data),
          total_variables = ncol(self$data),
          analysis_version = "1.0"
        )
      )
      
      # Add all analysis results
      report <- append(report, self$results)
      
      # Add visualization recommendations
      report$visualization_recommendations <- list(
        required_plots = list(
          list(
            type = "propensity_score_distribution",
            description = "Histogram of propensity scores by treatment group",
            purpose = "Assess overlap and positivity",
            file_path = "plots/propensity_scores.png"
          ),
          list(
            type = "love_plot",
            description = "Standardized mean differences before and after adjustment",
            purpose = "Visualize covariate balance",
            file_path = "plots/love_plot.png"
          ),
          list(
            type = "missingness_pattern",
            description = "Heatmap of missing data patterns",
            purpose = "Identify missingness mechanisms",
            file_path = "plots/missingness_pattern.png"
          ),
          list(
            type = "correlation_matrix",
            description = "Correlation matrix of key variables",
            purpose = "Identify multicollinearity and relationships",
            file_path = "plots/correlation_matrix.png"
          ),
          list(
            type = "outcome_distributions",
            description = "Boxplots/violin plots of outcomes by treatment",
            purpose = "Show treatment effects visually",
            file_path = "plots/outcome_distributions.png"
          )
        )
      )
      
      # Add next steps
      report$next_steps <- list(
        immediate_actions = list(
          "Review data quality issues",
          "Address missing data patterns",
          "Consider variable transformations"
        ),
        analysis_pipeline = list(
          "Propensity score estimation and adjustment",
          "Primary causal effect estimation",
          "Sensitivity analyses",
          "Robustness checks"
        )
      )
      
      # Save report
      report_path <- file.path(output_dir, "eda_report.json")
      jsonlite::write_json(report, report_path, pretty = TRUE, auto_unbox = TRUE)
      
      invisible(report_path)
    }
  ),
  
  private = list(
    #' Validate that all specified variables exist
    validate_variables = function() {
      all_vars <- c(self$treatment_vars, self$outcome_vars, 
                   self$covariate_vars, self$instrument_vars)
      
      missing_vars <- setdiff(all_vars, names(self$data))
      if (length(missing_vars) > 0) {
        stop(sprintf("Variables not found in dataset: %s", paste(missing_vars, collapse = ", ")))
      }
    },
    
    #' Profile individual variable
    profile_variable = function(var_name) {
      series <- self$data[[var_name]]
      var_type <- private$infer_variable_type(series)
      
      profile <- list(
        type = var_type,
        missing_count = sum(is.na(series)),
        missing_percentage = mean(is.na(series)) * 100,
        unique_values = length(unique(series[!is.na(series)]))
      )
      
      if (var_type == "binary") {
        profile <- append(profile, private$profile_binary(series))
      } else if (var_type == "categorical") {
        profile <- append(profile, private$profile_categorical(series))
      } else if (var_type == "continuous") {
        profile <- append(profile, private$profile_continuous(series))
      } else if (var_type == "count") {
        profile <- append(profile, private$profile_count(series))
      }
      
      # Validation
      profile$validation <- private$validate_variable(var_name, profile)
      
      return(profile)
    },
    
    #' Infer variable type from data characteristics
    infer_variable_type = function(series) {
      if (is.logical(series) || (is.character(series) && length(unique(series[!is.na(series)])) == 2)) {
        return("binary")
      } else if (is.character(series) || is.factor(series)) {
        return("categorical")
      } else if (is.numeric(series)) {
        if (min(series, na.rm = TRUE) >= 0 && length(unique(series[!is.na(series)])) < 50) {
          return("count")
        } else {
          return("continuous")
        }
      } else {
        return("unknown")
      }
    },
    
    #' Profile binary variable
    profile_binary = function(series) {
      clean_series <- series[!is.na(series)]
      value_counts <- table(clean_series)
      total <- length(clean_series)
      
      list(
        distribution = list(
          "0" = as.integer(value_counts["0"] %||% 0),
          "1" = as.integer(value_counts["1"] %||% 0),
          rate = as.numeric((value_counts["1"] %||% 0) / total)
        )
      )
    },
    
    #' Profile categorical variable
    profile_categorical = function(series) {
      clean_series <- series[!is.na(series)]
      value_counts <- table(clean_series)
      total <- length(clean_series)
      
      list(
        distribution = list(
          category_counts = as.list(value_counts),
          category_percentages = as.list(round(value_counts / total * 100, 2))
        )
      )
    },
    
    #' Profile continuous variable
    profile_continuous = function(series) {
      clean_series <- series[!is.na(series)]
      
      stats_dict <- list(
        mean = as.numeric(mean(clean_series)),
        median = as.numeric(median(clean_series)),
        std = as.numeric(sd(clean_series)),
        min = as.numeric(min(clean_series)),
        max = as.numeric(max(clean_series)),
        q25 = as.numeric(quantile(clean_series, 0.25)),
        q75 = as.numeric(quantile(clean_series, 0.75)),
        skewness = as.numeric(e1071::skewness(clean_series)),
        kurtosis = as.numeric(e1071::kurtosis(clean_series))
      )
      
      # Outlier detection using IQR method
      Q1 <- stats_dict$q25
      Q3 <- stats_dict$q75
      IQR <- Q3 - Q1
      lower_bound <- Q1 - 1.5 * IQR
      upper_bound <- Q3 + 1.5 * IQR
      
      outliers <- clean_series[clean_series < lower_bound | clean_series > upper_bound]
      
      stats_dict$outliers_count <- length(outliers)
      stats_dict$outliers_percentage <- length(outliers) / length(clean_series) * 100
      
      return(list(statistics = stats_dict))
    },
    
    #' Profile count variable
    profile_count = function(series) {
      clean_series <- series[!is.na(series)]
      
      list(
        statistics = list(
          mean = as.numeric(mean(clean_series)),
          median = as.numeric(median(clean_series)),
          std = as.numeric(sd(clean_series)),
          min = as.integer(min(clean_series)),
          max = as.integer(max(clean_series)),
          zero_inflation = mean(clean_series == 0) * 100
        )
      )
    },
    
    #' Validate variable against expected specifications
    validate_variable = function(var_name, profile) {
      missing_pct <- profile$missing_percentage
      
      # Check missingness
      if (missing_pct > 20) {
        return("FAIL - High missingness > 20%")
      } else if (missing_pct > 5) {
        return("WARNING - Moderate missingness > 5%")
      }
      
      # Check for binary variables with invalid values
      if (profile$type == "binary") {
        total_valid <- profile$distribution$`0` + profile$distribution$`1`
        if (total_valid != length(self$data[[var_name]]) - profile$missing_count) {
          return("FAIL - Invalid values in binary variable")
        }
      }
      
      # Check for continuous variables with extreme outliers
      if (profile$type == "continuous") {
        outlier_pct <- profile$statistics$outliers_percentage
        if (outlier_pct > 10) {
          return("WARNING - High outlier percentage > 10%")
        }
      }
      
      return("PASS - No major issues detected")
    },
    
    #' Assess overall data quality
    assess_overall_quality = function() {
      complete_cases <- sum(complete.cases(self$data))
      total_obs <- nrow(self$data)
      
      # Check critical variables (treatment and outcome)
      critical_vars <- c(self$treatment_vars, self$outcome_vars)
      critical_missing <- any(
        sapply(critical_vars, function(var) {
          if (var %in% names(self$data)) {
            mean(is.na(self$data[[var]])) > 0.05
          } else {
            FALSE
          }
        })
      )
      
      # Calculate data quality score (0-1)
      quality_score <- complete_cases / total_obs
      if (critical_missing) {
        quality_score <- quality_score * 0.8  # Penalize for critical missingness
      }
      
      list(
        complete_cases = complete_cases,
        complete_case_percentage = complete_cases / total_obs * 100,
        critical_variables_missingness = if (critical_missing) "FAIL" else "PASS",
        data_quality_score = round(quality_score, 3),
        duplicate_records = sum(duplicated(self$data)),
        duplicate_percentage = sum(duplicated(self$data)) / total_obs * 100
      )
    },
    
    #' Analyze patterns of missingness
    analyze_missingness_patterns = function() {
      missing_matrix <- is.na(self$data)
      
      # Check for monotone missingness
      monotone <- TRUE
      for (i in 2:ncol(missing_matrix)) {
        if (!all(missing_matrix[, i] >= missing_matrix[, i - 1], na.rm = TRUE)) {
          monotone <- FALSE
          break
        }
      }
      
      # Correlation of missingness indicators
      missing_corr <- cor(missing_matrix, use = "pairwise.complete.obs")
      
      list(
        monotone_missing = monotone,
        missingness_correlation = as.list(missing_corr),
        missingness_heatmap_data = as.matrix(missing_matrix)
      )
    },
    
    #' Assess likely missingness mechanism
    assess_missingness_mechanism = function() {
      # Simple heuristic assessment
      missing_patterns <- character(0)
      
      for (var in names(self$data)) {
        if (sum(is.na(self$data[[var]])) > 0) {
          # Check if missingness correlates with other variables
          missing_indicator <- as.numeric(is.na(self$data[[var]]))
          correlations <- numeric(0)
          
          for (other_var in names(self$data)) {
            if (other_var != var && is.numeric(self$data[[other_var]])) {
              corr <- cor(missing_indicator, self$data[[other_var]], use = "complete.obs")
              if (abs(corr) > 0.1) {
                correlations <- c(correlations, sprintf("%s: %.3f", other_var, corr))
              }
            }
          }
          
          if (length(correlations) > 0) {
            missing_patterns <- c(missing_patterns, sprintf("%s: %s", var, paste(correlations, collapse = ", ")))
          }
        }
      }
      
      mechanism <- if (length(missing_patterns) == 0) "MCAR" else "MAR"
      
      list(
        assessment = mechanism,
        rationale = if (length(missing_patterns) > 0) {
          sprintf("Missingness patterns detected: %s", paste(head(missing_patterns, 3), collapse = "; "))
        } else {
          "No clear patterns detected"
        },
        recommendation = if (mechanism == "MAR") "Multiple imputation" else "Complete case analysis"
      )
    },
    
    #' Assess impact of missingness on causal estimation
    assess_missingness_impact = function() {
      # Check missingness in treatment and outcome
      treatment_missing <- any(
        sapply(self$treatment_vars, function(var) {
          var %in% names(self$data) && sum(is.na(self$data[[var]])) > 0
        })
      )
      
      outcome_missing <- any(
        sapply(self$outcome_vars, function(var) {
          var %in% names(self$data) && sum(is.na(self$data[[var]])) > 0
        })
      )
      
      treatment_risk <- if (treatment_missing) "HIGH" else "LOW"
      outcome_risk <- if (outcome_missing) "HIGH" else "LOW"
      
      list(
        treatment_effect_bias_risk = treatment_risk,
        selection_bias_risk = outcome_risk,
        recommended_approach = if (outcome_missing) "Multiple imputation" else "Complete case analysis"
      )
    },
    
    #' Analyze propensity score distributions
    analyze_propensity_scores = function(treatment_var) {
      if (length(self$covariate_vars) == 0) {
        return(list(error = "No covariates specified for propensity score estimation"))
      }
      
      # Prepare data for propensity score modeling
      ps_data <- self$data %>% 
        select(all_of(c(treatment_var, self$covariate_vars))) %>% 
        drop_na()
      
      if (nrow(ps_data) < nrow(self$data) * 0.8) {
        return(list(error = "Too much missing data for propensity score estimation"))
      }
      
      # Fit propensity score model
      tryCatch({
        # Create formula
        formula_str <- sprintf("%s ~ %s", treatment_var, paste(self$covariate_vars, collapse = " + "))
        
        # Fit logistic regression
        ps_model <- glm(as.formula(formula_str), data = ps_data, family = binomial())
        
        # Get propensity scores
        propensity_scores <- predict(ps_model, type = "response")
        
        # Analyze overlap
        in_overlap <- (propensity_scores >= 0.1) & (propensity_scores <= 0.9)
        
        treated_mask <- ps_data[[treatment_var]] == 1
        control_mask <- ps_data[[treatment_var]] == 0
        
        list(
          model = sprintf("Logistic regression with %d predictors", length(coef(ps_model)) - 1),
          propensity_score_range = list(
            min = min(propensity_scores),
            max = max(propensity_scores),
            mean = mean(propensity_scores),
            median = median(propensity_scores)
          ),
          overlap_statistics = list(
            observations_in_0.1_0.9_range = sum(in_overlap),
            percentage_in_overlap = mean(in_overlap) * 100,
            treated_in_overlap = sum(in_overlap & treated_mask),
            control_in_overlap = sum(in_overlap & control_mask)
          ),
          positivity_violation = list(
            count_below_0.1 = sum(propensity_scores < 0.1),
            count_above_0.9 = sum(propensity_scores > 0.9),
            total_violations = sum(propensity_scores < 0.1 | propensity_scores > 0.9),
            violation_percentage = mean(propensity_scores < 0.1 | propensity_scores > 0.9) * 100
          )
        )
      }, error = function(e) {
        list(error = sprintf("Propensity score estimation failed: %s", e$message))
      })
    },
    
    #' Assess covariate balance between treatment groups
    assess_covariate_balance = function(treatment_var) {
      balance_results <- list(standardized_mean_differences = list())
      
      for (covariate in self$covariate_vars) {
        if (!covariate %in% names(self$data)) next
        
        treated <- self$data %>% filter(.data[[treatment_var]] == 1) %>% pull(!!covariate) %>% na.omit()
        control <- self$data %>% filter(.data[[treatment_var]] == 0) %>% pull(!!covariate) %>% na.omit()
        
        if (length(treated) == 0 || length(control) == 0) next
        
        # Calculate standardized mean difference
        mean_treated <- mean(treated)
        mean_control <- mean(control)
        pooled_std <- sqrt((var(treated) + var(control)) / 2)
        
        if (pooled_std > 0) {
          smd <- abs(mean_treated - mean_control) / pooled_std
          balance_results$standardized_mean_differences[[covariate]] <- smd
        }
      }
      
      # Categorize balance
      smd_dict <- balance_results$standardized_mean_differences
      balanced <- names(smd_dict)[smd_dict < 0.1]
      moderate <- names(smd_dict)[smd_dict >= 0.1 & smd_dict < 0.2]
      imbalanced <- names(smd_dict)[smd_dict >= 0.2]
      
      balance_results$balance_assessment <- list(
        variables_balanced_smd_0.1 = balanced,
        variables_moderately_imbalanced_smd_0.1_0.2 = moderate,
        variables_imbalanced_smd_0.2 = imbalanced,
        overall_balance = if (length(imbalanced) == 0) "GOOD" else if (length(imbalanced) <= 2) "MODERATE" else "POOR"
      )
      
      return(balance_results)
    },
    
    #' Validate positivity assumption
    validate_positivity = function() {
      if (!"overlap_positivity_assessment" %in% names(self$results)) {
        return(list(criteria_met = "UNKNOWN", recommendation = "Run overlap assessment first"))
      }
      
      overlap_pct <- self$results$overlap_positivity_assessment$propensity_score_analysis$overlap_statistics$percentage_in_overlap %||% 0
      
      criteria_met <- if (overlap_pct >= 80) "PASS" else "FAIL"
      recommendation <- if (overlap_pct >= 80) "Good overlap" else "Consider trimming extreme propensity scores"
      
      return(list(
        criteria_met = criteria_met,
        recommendation = recommendation
      ))
    },
    
    #' Check for multicollinearity among covariates
    check_multicollinearity = function() {
      numeric_covariates <- self$covariate_vars[sapply(self$covariate_vars, function(var) {
        var %in% names(self$data) && is.numeric(self$data[[var]])
      })]
      
      if (length(numeric_covariates) < 2) {
        return(list(multicollinearity_assessment = "INSUFFICIENT_DATA"))
      }
      
      # Calculate VIFs
      X <- self$data %>% select(all_of(numeric_covariates)) %>% drop_na()
      if (nrow(X) < nrow(self$data) * 0.8) {
        return(list(multicollinearity_assessment = "TOO_MUCH_MISSING_DATA"))
      }
      
      vif_dict <- numeric(0)
      names(vif_dict) <- numeric_covariates
      
      for (var in numeric_covariates) {
        other_vars <- setdiff(numeric_covariates, var)
        if (length(other_vars) == 0) {
          vif_dict[var] <- 1.0
          next
        }
        
        formula_str <- sprintf("%s ~ %s", var, paste(other_vars, collapse = " + "))
        
        tryCatch({
          model <- lm(as.formula(formula_str), data = X)
          r_squared <- summary(model)$r.squared
          vif <- 1 / (1 - r_squared)
          vif_dict[var] <- if (is.finite(vif)) vif else Inf
        }, error = function(e) {
          vif_dict[var] <- Inf
        })
      }
      
      max_vif <- max(vif_dict, na.rm = TRUE)
      assessment <- if (max_vif < 5) "PASS" else if (max_vif < 10) "WARNING" else "FAIL"
      
      return(list(
        variance_inflation_factors = as.list(vif_dict),
        multicollinearity_assessment = assessment
      ))
    },
    
    #' Check instrument relevance for IV designs
    check_instrument_relevance = function() {
      if (length(self$instrument_vars) == 0 || length(self$treatment_vars) == 0) {
        return(list(instrument_strength = "NO_INSTRUMENTS"))
      }
      
      instrument_var <- self$instrument_vars[1]
      treatment_var <- self$treatment_vars[1]
      
      if (!instrument_var %in% names(self$data) || !treatment_var %in% names(self$data)) {
        return(list(instrument_strength = "MISSING_VARIABLES"))
      }
      
      # First stage regression
      tryCatch({
        formula_str <- sprintf("%s ~ %s", treatment_var, instrument_var)
        model <- lm(as.formula(formula_str), data = self$data)
        
        # Calculate F-statistic
        f_stat <- summary(model)$fstatistic[1]
        correlation <- cor(self$data[[instrument_var]], self$data[[treatment_var]], use = "complete.obs")
        
        # Compliance rates (simplified)
        compliance_data <- self.data %>% 
          select(all_of(c(instrument_var, treatment_var))) %>% 
          drop_na()
        
        always_takers <- mean(compliance_data[[instrument_var]] == 0 & compliance_data[[treatment_var]] == 1, na.rm = TRUE)
        never_takers <- mean(compliance_data[[instrument_var]] == 1 & compliance_data[[treatment_var]] == 0, na.rm = TRUE)
        compliers <- 1 - always_takers - never_takers
        
        strength <- if (f_stat > 10) "STRONG" else if (f_stat > 4) "MODERATE" else "WEAK"
        
        return(list(
          first_stage_f_statistic = as.numeric(f_stat),
          instrument_treatment_correlation = as.numeric(correlation),
          compliance_rates = list(
            always_takers = as.numeric(always_takers),
            never_takers = as.numeric(never_takers),
            compliers = as.numeric(compliers)
          ),
          instrument_strength = strength
        ))
      }, error = function(e) {
        return(list(instrument_strength = sprintf("ERROR: %s", e$message)))
      })
    },
    
    #' Plot propensity score distributions
    plot_propensity_scores = function(output_dir) {
      tryCatch({
        if (length(self$treatment_vars) != 1) return(NULL)
        
        treatment_var <- self$treatment_vars[1]
        
        p <- ggplot(self$data, aes_string(x = treatment_var, fill = factor(.data[[treatment_var]]))) +
          geom_histogram(bins = 30, alpha = 0.7) +
          labs(title = "Treatment Assignment Distribution",
               x = "Treatment Assignment",
               y = "Count") +
          theme_minimal()
        
        plot_path <- file.path(output_dir, "propensity_scores.png")
        ggsave(plot_path, plot = p, dpi = 300, width = 10, height = 6)
        
        return(plot_path)
      }, error = function(e) {
        message(sprintf("Error plotting propensity scores: %s", e$message))
        return(NULL)
      })
    },
    
    #' Plot Love plot for covariate balance
    plot_love_plot = function(output_dir) {
      tryCatch({
        if (!"overlap_positivity_assessment" %in% names(self$results)) return(NULL)
        
        balance_data <- self$results$overlap_positivity_assessment$covariate_balance$standardized_mean_differences
        
        if (length(balance_data) == 0) return(NULL)
        
        plot_data <- data.frame(
          variable = names(balance_data),
          smd = unlist(balance_data)
        )
        
        plot_data$color <- ifelse(abs(plot_data$smd) >= 0.2, "red",
                                 ifelse(abs(plot_data$smd) >= 0.1, "orange", "green"))
        
        p <- ggplot(plot_data, aes(x = reorder(variable, smd), y = smd, fill = color)) +
          geom_col(alpha = 0.7) +
          geom_hline(yintercept = 0.1, linetype = "dashed", color = "orange") +
          geom_hline(yintercept = -0.1, linetype = "dashed", color = "orange") +
          geom_hline(yintercept = 0.2, linetype = "dashed", color = "red") +
          geom_hline(yintercept = -0.2, linetype = "dashed", color = "red") +
          geom_hline(yintercept = 0, linetype = "solid", color = "black", alpha = 0.3) +
          coord_flip() +
          labs(title = "Covariate Balance (Love Plot)",
               x = "Variables",
               y = "Standardized Mean Difference") +
          scale_fill_identity() +
          theme_minimal()
        
        plot_path <- file.path(output_dir, "love_plot.png")
        ggsave(plot_path, plot = p, dpi = 300, width = 10, height = 8)
        
        return(plot_path)
      }, error = function(e) {
        message(sprintf("Error plotting Love plot: %s", e$message))
        return(NULL)
      })
    },
    
    #' Plot missingness pattern heatmap
    plot_missingness_pattern = function(output_dir) {
      tryCatch({
        plot_path <- file.path(output_dir, "missingness_pattern.png")
        
        # Use VIM package for missingness plot
        png(plot_path, width = 1200, height = 800, res = 300)
        VIM::aggr(self$data, col = c('navyblue', 'red'), numbers = TRUE, sortVars = TRUE)
        dev.off()
        
        return(plot_path)
      }, error = function(e) {
        message(sprintf("Error plotting missingness pattern: %s", e$message))
        return(NULL)
      })
    },
    
    #' Plot correlation matrix
    plot_correlation_matrix = function(output_dir) {
      tryCatch({
        # Select numeric variables
        numeric_vars <- names(self$data)[sapply(self$data, is.numeric)]
        if (length(numeric_vars) < 2) return(NULL)
        
        corr_matrix <- cor(self.data[, numeric_vars], use = "complete.obs")
        
        plot_path <- file.path(output_dir, "correlation_matrix.png")
        png(plot_path, width = 1200, height = 1000, res = 300)
        corrplot(corr_matrix, method = "color", type = "upper", 
                 order = "hclust", tl.cex = 0.8, tl.col = "black",
                 addCoef.col = "black", number.cex = 0.7)
        dev.off()
        
        return(plot_path)
      }, error = function(e) {
        message(sprintf("Error plotting correlation matrix: %s", e$message))
        return(NULL)
      })
    },
    
    #' Plot outcome distributions by treatment
    plot_outcome_distributions = function(output_dir) {
      tryCatch({
        if (length(self$treatment_vars) != 1 || length(self$outcome_vars) != 1) return(NULL)
        
        treatment_var <- self$treatment_vars[1]
        outcome_var <- self$outcome_vars[1]
        
        p1 <- ggplot(self$data, aes_string(x = factor(.data[[treatment_var]]), y = outcome_var)) +
          geom_boxplot() +
          labs(title = sprintf("%s by %s", outcome_var, treatment_var),
               x = treatment_var,
               y = outcome_var) +
          theme_minimal()
        
        p2 <- ggplot(self$data, aes_string(x = outcome_var, fill = factor(.data[[treatment_var]]))) +
          geom_histogram(bins = 30, alpha = 0.7, position = "identity") +
          labs(title = sprintf("%s Distribution", outcome_var),
               x = outcome_var,
               y = "Count",
               fill = treatment_var) +
          theme_minimal()
        
        plot_path <- file.path(output_dir, "outcome_distributions.png")
        ggsave(plot_path, plot = gridExtra::grid.arrange(p1, p2, ncol = 2), 
               dpi = 300, width = 15, height = 6)
        
        return(plot_path)
      }, error = function(e) {
        message(sprintf("Error plotting outcome distributions: %s", e$message))
        return(NULL)
      })
    }
  )
)

# Helper function for null coalescing
`%||%` <- function(x, y) if (is.null(x)) y else x

# Example usage function
run_causal_eda <- function(data_path, config_path, output_dir = "eda_results") {
  # Load data
  data <- read.csv(data_path)
  
  # Load configuration
  config <- jsonlite::read_json(config_path)
  
  # Initialize and run EDA
  eda <- CausalEDA$new(data, config)
  results <- eda$run_full_analysis(output_dir)
  
  return(results)
}